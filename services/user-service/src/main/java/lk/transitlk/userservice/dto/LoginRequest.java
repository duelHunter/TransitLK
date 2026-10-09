package lk.transitlk.userservice.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String emailOrPhone,
        @NotBlank String password
) {
}
