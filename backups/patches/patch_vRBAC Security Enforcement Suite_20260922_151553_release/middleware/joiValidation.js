import Joi from 'joi';
import { ApiError } from './errors.js';

export const joiSchemas = {
  // Booking / Reservation Payload Schema
  reservation: Joi.object({
    roomId: Joi.string().required().messages({
      'any.required': 'Room ID is required',
    }),
    check_in: Joi.string().isoDate().required().messages({
      'string.isoDate': 'Check-in must be a valid ISO date (YYYY-MM-DD)',
      'any.required': 'Check-in date is required',
    }),
    check_out: Joi.string().isoDate().required().messages({
      'string.isoDate': 'Check-out must be a valid ISO date (YYYY-MM-DD)',
      'any.required': 'Check-out date is required',
    }),
    guests: Joi.number().integer().min(1).max(20).required().messages({
      'number.min': 'Guest count must be at least 1',
      'number.max': 'Guest count cannot exceed 20',
      'any.required': 'Number of guests is required',
    }),
    notes: Joi.string().max(500).allow('').optional(),
    phone: Joi.string().pattern(/^[+\d\s\-()]{7,20}$/).allow('').optional().messages({
      'string.pattern.base': 'Phone number must be a valid international or local phone format',
    }),
  }),

  // Department Task Transition Schema
  taskStatus: Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').required().messages({
      'any.only': 'Status must be one of: pending, in_progress, completed, cancelled',
      'any.required': 'Status is required',
    }),
  }),

  // Authentication Credentials Schema
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid email address is required',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required',
    }),
  }),

  // Customer Dining & Concierge Order Schema
  order: Joi.object({
    items: Joi.array().items(
      Joi.object({
        service_id: Joi.string().required(),
        qty: Joi.number().integer().min(1).default(1),
      })
    ).min(1).required(),
    notes: Joi.string().max(300).allow('').optional(),
    delivery_room: Joi.string().max(50).allow('').optional(),
  }),

  // Account Recovery Schemas
  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid registered email address is required',
      'any.required': 'Registered email is required',
    }),
  }),

  verifyRecovery: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid registered email address is required',
      'any.required': 'Registered email is required',
    }),
    code: Joi.string().trim().length(6).required().messages({
      'string.length': 'Recovery verification code must be exactly 6 characters',
      'any.required': 'Recovery code is required',
    }),
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid registered email address is required',
      'any.required': 'Registered email is required',
    }),
    code: Joi.string().trim().length(6).required().messages({
      'string.length': 'Recovery verification code must be exactly 6 characters',
      'any.required': 'Recovery code is required',
    }),
    new_password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'New password must be at least 6 characters long',
      'any.required': 'New password is required',
    }),
  }),

  // Ledger Ingestion Agent Schemas
  ledgerGuestLookup: Joi.object({
    full_name: Joi.string().trim().min(2).max(120).required().messages({
      'string.min': 'Guest full name must be at least 2 characters long',
      'any.required': 'Guest full name is required',
    }),
    phone: Joi.string().pattern(/^[+\d\s\-()]{7,20}$/).allow(null, '').optional().messages({
      'string.pattern.base': 'Phone number must be a valid E.164 or national format',
    }),
  }),

  ledgerReservation: Joi.object({
    room_slug: Joi.string().valid('unit-tev', 'unit-gel', 'unit-cat').required().messages({
      'any.only': 'room_slug must be one of: unit-tev, unit-gel, unit-cat',
      'any.required': 'room_slug is required',
    }),
    guest_id: Joi.string().guid().required().messages({
      'string.guid': 'guest_id must be a valid UUID',
      'any.required': 'guest_id is required',
    }),
    co_guests: Joi.array().items(Joi.string().trim().max(100)).default([]),
    check_in: Joi.string().isoDate().required().messages({
      'string.isoDate': 'check_in must be a valid ISO 8601 date (YYYY-MM-DD)',
      'any.required': 'check_in date is required',
    }),
    check_out: Joi.string().isoDate().required().messages({
      'string.isoDate': 'check_out must be a valid ISO 8601 date (YYYY-MM-DD)',
      'any.required': 'check_out date is required',
    }),
    guests: Joi.number().integer().min(1).max(100).required().messages({
      'number.min': 'Guest count must be at least 1',
      'any.required': 'guests count is required',
    }),
    total_php: Joi.number().integer().min(0).required().messages({
      'number.min': 'total_php cannot be negative',
      'any.required': 'total_php is required',
    }),
    downpayment_php: Joi.number().integer().min(0).default(0),
    payment_status: Joi.string().valid('unpaid', 'partial', 'paid').default('unpaid'),
    sub_unit_note: Joi.string().max(200).allow(null, '').optional(),
    notes: Joi.string().max(500).allow(null, '').optional(),
  }),
};

/**
 * Express Middleware factory for Joi contract validation
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @param {'body' | 'query' | 'params'} target - Request property to validate
 */
export function validateJoi(schema, target = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return next(new ApiError(400, `Validation Error: ${messages}`, error.details));
    }

    req[target] = value;
    next();
  };
}
