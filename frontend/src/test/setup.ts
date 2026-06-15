/**
 * Setup global cho Vitest — chạy 1 lần trước mọi file test.
 *
 * <p>Import {@code @testing-library/jest-dom} extend Vitest's {@code expect}
 * với matcher như {@code toBeInTheDocument}, {@code toHaveClass}, ... — chuẩn
 * RTL recommended pattern.
 */
import '@testing-library/jest-dom/vitest'
