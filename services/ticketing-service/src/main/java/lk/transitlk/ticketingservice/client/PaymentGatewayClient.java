package lk.transitlk.ticketingservice.client;

import lk.transitlk.ticketingservice.entity.PaymentMethod;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Stand-in for the certified external payment gateway (PayHere / LankaQR / bank cards)
 * shown in the context and deployment diagrams. Card data never reaches TransitLK -
 * the real gateway would return a tokenised reference; here we simulate that contract
 * with an always-approving mock so the booking -> payment -> ticket flow can be
 * exercised end-to-end without a live gateway integration.
 */
@Component
public class PaymentGatewayClient {

    public record ChargeResult(boolean approved, String txnRef, String message) {
    }

    public ChargeResult charge(BigDecimal amount, PaymentMethod method) {
        String txnRef = method.name() + "-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        return new ChargeResult(true, txnRef, "Approved");
    }
}
