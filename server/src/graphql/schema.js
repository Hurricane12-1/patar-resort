import { buildSchema } from 'graphql';

export const schema = buildSchema(`
  type Room {
    id: ID!
    name: String!
    slug: String!
    category: String!
    description: String
    capacity: Int!
    units: Int!
    rate_php: Float!
    rating_avg: Float
    rating_count: Int
    amenities: [String!]
  }

  type Reservation {
    id: ID!
    room_id: ID!
    guest_id: ID
    check_in: String!
    check_out: String!
    guests: Int!
    total_php: Float!
    status: String!
    notes: String
    created_at: String
    room: Room
  }

  type Profile {
    id: ID!
    full_name: String
    role: String!
    phone: String
    avatar_url: String
  }

  type AnalyticsOverview {
    arrivals_today: Int!
    departures_today: Int!
    occupancy_pct: Float!
    revenue_week_php: Float!
    total_revenue_php: Float!
    adr_php: Float!
    revpar_php: Float!
    room_revenue_php: Float!
    dining_revenue_php: Float!
    tour_revenue_php: Float!
    sms_delivered: Int!
  }

  type DepartmentTask {
    id: ID!
    department: String!
    title: String!
    room_name: String
    priority: String!
    assigned_to: String
    status: String!
    created_at: String
  }

  type NetworkStatus {
    status: String!
    latency_ms: Float!
    db_status: String!
    redis_status: String!
    tls_status: String!
    uptime_seconds: Int!
    timestamp: String!
  }

  type Query {
    rooms: [Room!]!
    room(id: ID!): Room
    roomBySlug(slug: String!): Room
    reservations(limit: Int): [Reservation!]!
    analytics: AnalyticsOverview!
    departmentTasks(department: String): [DepartmentTask!]!
    networkStatus: NetworkStatus!
  }

  type Mutation {
    createReservation(
      roomId: ID!
      check_in: String!
      check_out: String!
      guests: Int!
      notes: String
      phone: String
    ): Reservation!
    updateTaskStatus(id: ID!, status: String!): DepartmentTask!
  }
`);
