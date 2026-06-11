package com.cinex.security;

import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Dùng findActiveByUsername → user đã soft delete không qua được JWT filter
        User user = userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // theaterId — gắn vào principal để SecurityService access không cần query DB
        Long theaterId = user.getTheater() != null ? user.getTheater().getId() : null;

        return new CinexUserPrincipal(
                user.getUsername(),
                user.getPassword(),
                user.isEnabled(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())),
                theaterId
        );
    }
}
