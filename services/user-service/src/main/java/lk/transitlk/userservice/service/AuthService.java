package lk.transitlk.userservice.service;

import lk.transitlk.userservice.dto.*;
import lk.transitlk.userservice.entity.Role;
import lk.transitlk.userservice.entity.User;
import lk.transitlk.userservice.exception.ApiException;
import lk.transitlk.userservice.repository.UserRepository;
import lk.transitlk.userservice.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final UserEventPublisher eventPublisher;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                        JwtService jwtService, OtpService otpService, UserEventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public MessageResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        }
        if (userRepository.existsByPhone(req.phone())) {
            throw new ApiException(HttpStatus.CONFLICT, "Phone already registered");
        }

        Role role = req.roleEnum();
        User user = new User();
        user.setName(req.name());
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(role);
        if (role == Role.OPERATOR) {
            user.setLicenseNo(req.licenseNo());
        }
        user.setEnabled(false);
        otpService.issueOtp(user);
        userRepository.save(user);

        return new MessageResponse("Registered. An OTP has been sent to verify your account (see server logs in this prototype).");
    }

    @Transactional
    public AuthResponse verifyOtp(OtpVerifyRequest req) {
        User user = findByEmailOrPhone(req.emailOrPhone());
        if (!otpService.verify(user, req.otp())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP");
        }
        user.setEnabled(true);
        user.setOtpCode(null);
        user.setOtpExpiresAt(null);
        userRepository.save(user);
        eventPublisher.publishUserRegistered(user);

        String token = jwtService.generateToken(user);
        return AuthResponse.of(token, jwtService.getExpirationSeconds(), UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest req) {
        User user = findByEmailOrPhone(req.emailOrPhone());
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        if (!user.isEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Account not activated - verify OTP first");
        }
        String token = jwtService.generateToken(user);
        return AuthResponse.of(token, jwtService.getExpirationSeconds(), UserResponse.from(user));
    }

    @Transactional
    public MessageResponse resendOtp(String emailOrPhone) {
        User user = findByEmailOrPhone(emailOrPhone);
        otpService.issueOtp(user);
        userRepository.save(user);
        return new MessageResponse("OTP resent");
    }

    private User findByEmailOrPhone(String value) {
        return userRepository.findByEmail(value)
                .or(() -> userRepository.findByPhone(value))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
