package lk.transitlk.userservice.dto;

import lk.transitlk.userservice.entity.Role;
import lk.transitlk.userservice.entity.User;

import java.math.BigDecimal;
import java.util.UUID;

public record UserResponse(
        UUID userId,
        String name,
        String email,
        String phone,
        Role role,
        boolean enabled,
        BigDecimal walletBalance
) {
    public static UserResponse from(User u) {
        return new UserResponse(u.getUserId(), u.getName(), u.getEmail(), u.getPhone(),
                u.getRole(), u.isEnabled(), u.getWalletBalance());
    }
}
