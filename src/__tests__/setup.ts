import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Mock Razorpay
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return {
      orders: {
        create: jest.fn().mockResolvedValue({ id: 'fake_order_id' }),
      },
    };
  });
});

// Mock Email Service
jest.mock('../utils/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Mock Socket
jest.mock('../utils/socket', () => ({
  getIO: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
  initSocket: jest.fn(),
}));
