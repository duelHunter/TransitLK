package lk.transitlk.ticketingservice.repository;

import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {

    @Query("select t from Trip t where lower(t.route.origin) = lower(:origin) " +
           "and lower(t.route.destination) = lower(:destination) " +
           "and t.departureTime between :from and :to " +
           "order by t.departureTime asc")
    List<Trip> search(@Param("origin") String origin,
                       @Param("destination") String destination,
                       @Param("from") Instant from,
                       @Param("to") Instant to);

    List<Trip> findAllByOrderByDepartureTimeAsc();

    List<Trip> findByStatusOrderByDepartureTimeAsc(TripStatus status);

    List<Trip> findByOperatorIdOrderByDepartureTimeAsc(UUID operatorId);
}
