package lk.transitlk.ticketingservice.repository;

import lk.transitlk.ticketingservice.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {
    List<Ticket> findByPassengerIdOrderByIssuedAtDesc(UUID passengerId);
    List<Ticket> findByTrip_TripId(UUID tripId);
}
