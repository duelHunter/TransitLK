package lk.transitlk.userservice.service;

import lk.transitlk.userservice.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Simulates the SMS/email OTP provider from the context diagram. No real gateway is
 * wired up for the prototype, so the generated code is logged instead of sent.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int OTP_VALIDITY_MINUTES = 5;

    public void issueOtp(User user) {
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        user.setOtpCode(otp);
        user.setOtpExpiresAt(Instant.now().plus(OTP_VALIDITY_MINUTES, ChronoUnit.MINUTES));
        log.info("OTP for {} ({}): {} - valid {} minutes", user.getEmail(), user.getPhone(), otp, OTP_VALIDITY_MINUTES);
    }

    public boolean verify(User user, String otp) {
        if (user.getOtpCode() == null || user.getOtpExpiresAt() == null) {
            return false;
        }
        if (Instant.now().isAfter(user.getOtpExpiresAt())) {
            return false;
        }
        return user.getOtpCode().equals(otp);
    }
}
