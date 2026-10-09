package lk.transitlk.userservice.dto;

import jakarta.validation.constraints.NotBlank;

public record OtpVerifyRequest(
        @NotBlank String emailOrPhone,
        @NotBlank String otp
) {
}
