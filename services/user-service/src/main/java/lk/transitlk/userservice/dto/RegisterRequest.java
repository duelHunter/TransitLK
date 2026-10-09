package lk.transitlk.userservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lk.transitlk.userservice.entity.Role;

public record RegisterRequest(
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String phone,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
        @NotBlank String role,
        String licenseNo
) {
    public Role roleEnum() {
        return Role.valueOf(role.toUpperCase());
    }
}
