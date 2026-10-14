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
