import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../app';
import { Event } from '../modules/events/event.model';
import { Participation, ParticipationStatus } from '../modules/participation/participation.model';
import { User, UserRole } from '../modules/users/user.model';
import { env } from '../config/env';

// Helper to generate token
const generateToken = (userId: string, role: UserRole) => {
  return jwt.sign({ userId, role }, env.accessTokenSecret);
};

describe('Participation Race Conditions', () => {
  let organizerId: string;
  let organizerToken: string;
  let eventId: string;

  beforeAll(async () => {
    // Connect to test database (assuming env.mongoUri is set or using a test DB)
    const mongoUri = env.mongoUri || 'mongodb://localhost:27017/atria_test';
    await mongoose.connect(mongoUri);
    
    // Create an organizer
    const organizer = await User.create({
      name: 'Organizer',
      email: `org_${Date.now()}@test.com`,
      password: 'password123',
      role: UserRole.ORGANIZER
    });
    organizerId = organizer._id.toString();
    organizerToken = generateToken(organizerId, UserRole.ORGANIZER);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Participation.deleteMany({});
  });

  const createTestUsers = async (count: number) => {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await User.create({
        name: `User ${i}`,
        email: `user_${Date.now()}_${i}@test.com`,
        password: 'password123',
        role: UserRole.PARTICIPANT
      });
      users.push({
        id: user._id.toString(),
        token: generateToken(user._id.toString(), UserRole.PARTICIPANT)
      });
    }
    return users;
  };

  test('Case 1: Free Event - Last Seat Race', async () => {
    // 1. Setup: Free event with 1 seat
    const event = await Event.create({
      title: 'Race Event Free',
      description: 'Test',
      eventType: 'CONFERENCE',
      location: 'Test Location',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      createdBy: organizerId,
      totalSeats: 1,
      availableSeats: 1,
      isPaid: false,
      status: 'REGISTRATION_OPEN',
      registrationStartDate: new Date(Date.now() - 3600000),
      registrationEndDate: new Date(Date.now() + 3600000),
      capabilities: { registration: true }
    });
    eventId = event._id.toString();

    // 2. Simulate 5 concurrent registrations
    const testUsers = await createTestUsers(5);
    
    console.log(`Firing 5 concurrent requests for free event ${eventId}...`);
    
    const results = await Promise.all(
      testUsers.map(user => 
        request(app)
          .post(`/api/participation/${eventId}/register`)
          .set('Authorization', `Bearer ${user.token}`)
          .send({})
      )
    );

    // 3. Assertions
    const participations = await Participation.find({ event: eventId });
    const registered = participations.filter(p => p.status === ParticipationStatus.REGISTERED);
    const waitlisted = participations.filter(p => p.status === ParticipationStatus.WAITLISTED);

    console.log(`Results: ${registered.length} REGISTERED, ${waitlisted.length} WAITLISTED`);

    expect(participations.length).toBe(5);
    expect(registered.length).toBe(1);
    expect(waitlisted.length).toBe(4);

    const updatedEvent = await Event.findById(eventId);
    expect(updatedEvent?.availableSeats).toBe(0);
  });

  test('Case 2: Paid Event - Seat Lock Race', async () => {
    // 1. Setup: Paid event with 1 seat
    const event = await Event.create({
      title: 'Race Event Paid',
      description: 'Test',
      eventType: 'CONFERENCE',
      location: 'Test Location',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      createdBy: organizerId,
      totalSeats: 1,
      availableSeats: 1,
      isPaid: true,
      price: 100,
      status: 'REGISTRATION_OPEN',
      registrationStartDate: new Date(Date.now() - 3600000),
      registrationEndDate: new Date(Date.now() + 3600000),
      capabilities: { registration: true }
    });
    eventId = event._id.toString();

    // 2. Simulate 5 concurrent registrations
    const testUsers = await createTestUsers(5);
    
    const results = await Promise.all(
      testUsers.map(user => 
        request(app)
          .post(`/api/participation/${eventId}/register`)
          .set('Authorization', `Bearer ${user.token}`)
          .send({})
      )
    );

    // 3. Assertions
    const participations = await Participation.find({ event: eventId });
    const pending = participations.filter(p => p.status === ParticipationStatus.PENDING_PAYMENT);
    const waitlisted = participations.filter(p => p.status === ParticipationStatus.WAITLISTED);

    console.log(`Results: ${pending.length} PENDING_PAYMENT, ${waitlisted.length} WAITLISTED`);

    expect(participations.length).toBe(5);
    expect(pending.length).toBe(1);
    expect(waitlisted.length).toBe(4);
    
    if (pending.length > 0) {
      expect(pending[0].lockedUntil).not.toBeNull();
      expect(new Date(pending[0].lockedUntil!).getTime()).toBeGreaterThan(Date.now());
    }

    const updatedEvent = await Event.findById(eventId);
    expect(updatedEvent?.availableSeats).toBe(0);
  });

  test('Case 3: Concurrent Payment Verification (Idempotency)', async () => {
    // 1. Setup: Paid event and a PENDING_PAYMENT record
    const event = await Event.create({
      title: 'Race Event Verify',
      description: 'Test',
      eventType: 'CONFERENCE',
      location: 'Test Location',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      createdBy: organizerId,
      totalSeats: 10,
      availableSeats: 9, // One seat already locked
      isPaid: true,
      price: 100,
      status: 'REGISTRATION_OPEN',
      registrationStartDate: new Date(Date.now() - 3600000),
      registrationEndDate: new Date(Date.now() + 3600000),
      capabilities: { registration: true }
    });
    eventId = event._id.toString();

    const testUsers = await createTestUsers(1);
    const user = testUsers[0];

    const participation = await Participation.create({
      event: eventId,
      user: user.id,
      status: ParticipationStatus.PENDING_PAYMENT,
      lockedUntil: new Date(Date.now() + 600000),
      razorpayOrderId: 'fake_order_id_123'
    });

    // 2. Simulate 3 concurrent verification requests
    // We mock the signature verification to always succeed for this test
    // Actually, we'll just mock the crypto check in the controller if needed, 
    // but here we can just fire them.
    
    console.log(`Firing 3 concurrent verification requests for participation ${participation._id}...`);

    const orderId = 'fake_order_id_123';
    const paymentId = 'pay_fake_123';
    const keySecret = env.razorpayKeySecret || "";
    const validSignature = require('crypto')
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const results = await Promise.all(
      [1, 2, 3].map(() => 
        request(app)
          .post('/api/participation/verify-payment')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: validSignature
          })
      )
    );

    // 3. Assertions
    const updatedParticipation = await Participation.findById(participation._id);
    expect(updatedParticipation?.status).toBe(ParticipationStatus.REGISTERED);

    // Check availableSeats on event
    const updatedEvent = await Event.findById(eventId);
    // It was 9 (one lock). After verification, it should still be 9 (but permanent).
    // Wait, in my service logic, registerParticipant decrements availableSeats when it creates the PENDING_PAYMENT lock.
    // So 10 -> 9. After verification, it stays 9.
    expect(updatedEvent?.availableSeats).toBe(9);

    // Verify no duplicate history (if we had a history model, but here we'll check status transitions)
    // In our case, idempotency is handled by checking if status is already REGISTERED.
    const successCount = results.filter(r => r.status === 200).length;
    console.log(`Verification results: ${successCount} successful responses`);
    expect(successCount).toBeGreaterThanOrEqual(1);
  });
});
