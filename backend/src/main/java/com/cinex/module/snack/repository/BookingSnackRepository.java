package com.cinex.module.snack.repository;

import com.cinex.module.snack.entity.BookingSnack;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingSnackRepository extends JpaRepository<BookingSnack, Long> {
}
