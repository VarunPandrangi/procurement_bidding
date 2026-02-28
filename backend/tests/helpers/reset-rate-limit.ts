import { resetAuthRateLimit } from '../../src/middleware/rate-limit';

beforeEach(() => {
  resetAuthRateLimit();
});
