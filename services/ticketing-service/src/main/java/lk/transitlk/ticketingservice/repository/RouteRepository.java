package lk.transitlk.ticketingservice.repository;

import lk.transitlk.ticketingservice.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RouteRepository extends JpaRepository<Route, UUID> {
    List<Route> findByOriginIgnoreCaseAndDestinationIgnoreCase(String origin, String destination);
}
