package lk.transitlk.userservice.controller;

import lk.transitlk.userservice.dto.UserResponse;
import lk.transitlk.userservice.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        UUID id = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(UserResponse.from(userService.getById(id)));
    }

    /** Used internally by other services (e.g. ticketing) to resolve a passenger's profile. */
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> byId(@PathVariable UUID id) {
        return ResponseEntity.ok(UserResponse.from(userService.getById(id)));
    }
}
