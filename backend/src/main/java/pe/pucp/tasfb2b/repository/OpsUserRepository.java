package pe.pucp.tasfb2b.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.pucp.tasfb2b.domain.OpsUser;

import java.util.Optional;

@Repository
public interface OpsUserRepository extends JpaRepository<OpsUser, Long> {

    Optional<OpsUser> findByUsername(String username);
}
