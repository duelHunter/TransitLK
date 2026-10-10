package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.client.PaymentGatewayClient;
import lk.transitlk.ticketingservice.dto.BookingRequest;
import lk.transitlk.ticketingservice.dto.TicketResponse;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.PaymentRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Implements FR4/FR5/FR6 (booking, fare calc, payment, QR issuance) as a single local
 * transaction. The report's target architecture uses a saga across separate booking and
 * payment services (section 6.6); here payment is a synchronous in-process call so the
 * "reserve seat -> charge -> issue ticket" sequence stays atomic for the prototype, while
 * still failing closed - a declined charge releases the seat and no ticket is created.
 */
@Service
public class BookingService {

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentGatewayClient paymentGatewayClient;
    private final TicketSigningService signingService;
    private final QrImageService qrImageService;
    private final EventPublisher eventPublisher;

    public BookingService(TripRepository tripRepository, TicketRepository ticketRepository,
                           PaymentRepository paymentRepository, PaymentGatewayClient paymentGatewayClient,
                           TicketSigningService signingService, QrImageService qrImageService,
                           EventPublisher eventPublisher) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
        this.paymentRepository = paymentRepository;
        this.paymentGatewayClient = paymentGatewayClient;
        this.signingService = signingService;
        this.qrImageService = qrImageService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public TicketResponse book(UUID passengerId, BookingRequest req) {
        Trip trip = tripRepository.findById(req.tripId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));

        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip is not open for booking");
        }
        if (trip.getAvailableSeats() <= 0) {
            throw new ApiException(HttpStatus.CONFLICT, "No seats available on this trip");
        }

        BigDecimal fare = trip.getRoute().calculateFare();

        PaymentGatewayClient.ChargeResult charge = paymentGatewayClient.charge(fare, req.methodEnum());
        Payment payment = new Payment();
        payment.setAmount(fare);
        payment.setMethod(req.methodEnum());
        payment.setTxnRef(charge.txnRef());
        payment.setStatus(charge.approved() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
        payment = paymentRepository.save(payment);
        eventPublisher.publishPaymentProcessed(payment, passengerId);

        if (!charge.approved()) {
            throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "Payment declined: " + charge.message());
        }

        trip.setAvailableSeats(trip.getAvailableSeats() - 1);
        tripRepository.save(trip);

        Ticket ticket = new Ticket();
        ticket.setTrip(trip);
        ticket.setPassengerId(passengerId);
        ticket.setSeatNo(req.seatNo());
        ticket.setFare(fare);
        ticket.setPayment(payment);
        ticket.setStatus(TicketStatus.ISSUED);
        // Persist first to obtain a ticketId, then sign - the QR payload embeds that id.
        // qr_code is NOT NULL, so the first insert carries a placeholder replaced right below.
        ticket.setQrCode("PENDING");
        ticket = ticketRepository.save(ticket);
        ticket.setQrCode(signingService.sign(ticket));
        ticket = ticketRepository.save(ticket);

        eventPublisher.publishTicketIssued(ticket);

        return TicketResponse.from(ticket, qrImageService.toBase64Png(ticket.getQrCode()));
    }

    public TicketResponse getTicket(UUID ticketId, UUID requesterId, boolean isPrivileged) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!isPrivileged && !ticket.getPassengerId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your ticket");
        }
        return TicketResponse.from(ticket, qrImageService.toBase64Png(ticket.getQrCode()));
    }

    public List<TicketResponse> myTickets(UUID passengerId) {
        return ticketRepository.findByPassengerIdOrderByIssuedAtDesc(passengerId).stream()
                .map(t -> TicketResponse.from(t, qrImageService.toBase64Png(t.getQrCode())))
                .toList();
    }

    @Transactional
    public TicketResponse cancel(UUID ticketId, UUID passengerId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!ticket.getPassengerId().equals(passengerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your ticket");
        }
        if (ticket.getStatus() != TicketStatus.ISSUED) {
            throw new ApiException(HttpStatus.CONFLICT, "Only an unused ticket can be cancelled");
        }
        ticket.setStatus(TicketStatus.CANCELLED);
        Trip trip = ticket.getTrip();
        trip.setAvailableSeats(trip.getAvailableSeats() + 1);
        tripRepository.save(trip);
        ticketRepository.save(ticket);
        eventPublisher.publishTicketCancelled(ticket);
        return TicketResponse.from(ticket, qrImageService.toBase64Png(ticket.getQrCode()));
    }
}
