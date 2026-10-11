package lk.transitlk.userservice.service;

import lk.transitlk.userservice.dto.RegisterRequest;
import lk.transitlk.userservice.entity.Role;
import lk.transitlk.userservice.entity.User;
import lk.transitlk.userservice.exception.ApiException;
import lk.transitlk.userservice.repository.UserRepository;
import lk.transitlk.userservice.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRegistrationTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock OtpService otpService;
    @Mock UserEventPublisher eventPublisher;
    @InjectMocks AuthService authService;

    private static RegisterRequest request(String role) {
        return new RegisterRequest("Test User", "test@example.com", "0771234567", "password123", role, "LIC-1");
    }

    @Test
    void passengersConductorsAndOperatorsMayRegister() {
        when(passwordEncoder.encode(any())).thenReturn("hash");
        for (String role : new String[]{"PASSENGER", "conductor", "OPERATOR"}) {
            authService.register(request(role));
        }

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository, org.mockito.Mockito.times(3)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(User::getRole)
                .containsExactly(Role.PASSENGER, Role.CONDUCTOR, Role.OPERATOR);
        assertThat(saved.getAllValues()).allSatisfy(u -> assertThat(u.isEnabled()).isFalse());
    }

    @Test
    void adminCannotBeSelfRegistered() {
        assertThatThrownBy(() -> authService.register(request("ADMIN")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(userRepository, never()).save(any());
    }

    @Test
    void unknownRolesAreABadRequestNotAServerError() {
        for (String role : new String[]{"REGULATOR", "superuser", ""}) {
            assertThatThrownBy(() -> authService.register(request(role)))
                    .isInstanceOf(ApiException.class)
                    .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
        verify(userRepository, never()).save(any());
    }
}
