const path = require("path");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { connectMongo, mongoose } = require("./db/pool");
const {
  Customer,
  Wallet,
  MenuItem,
  LoyaltyDeal,
  CustomerDeal,
  LoyaltyTransaction,
  Order,
  Reservation,
  PaymentMethod,
  User
} = require("./models");

async function seed() {
  await connectMongo();

  await Promise.all([
    Customer.deleteMany({}),
    Wallet.deleteMany({}),
    MenuItem.deleteMany({}),
    LoyaltyDeal.deleteMany({}),
    CustomerDeal.deleteMany({}),
    LoyaltyTransaction.deleteMany({}),
    Order.deleteMany({}),
    Reservation.deleteMany({}),
    PaymentMethod.deleteMany({}),
    User.deleteMany({})
  ]);

  const alex = await Customer.create({
    firstName: "Alex",
    lastName: "Rivera",
    email: "alex.rivera@example.com",
    loyaltyTier: "Gold",
    pointsBalance: 12450,
    tierExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90)
  });

  const lucia = await Customer.create({
    firstName: "Lucia",
    lastName: "Romero",
    email: "lucia.romero@example.com",
    loyaltyTier: "Platinum",
    pointsBalance: 32200,
    tierExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)
  });

  await Wallet.create({
    customer: alex._id,
    balanceCents: 12000,
    autoReloadThresholdCents: 5000,
    autoReloadAmountCents: 7500
  });

  await PaymentMethod.create([
    {
      customer: alex._id,
      brand: "Visa",
      last4: "4242",
      expiresMonth: 4,
      expiresYear: 2026,
      isDefault: true
    },
    {
      customer: alex._id,
      brand: "American Express",
      last4: "3005",
      expiresMonth: 11,
      expiresYear: 2025,
      isDefault: false
    }
  ]);

  const menuItems = await MenuItem.create([
    {
      name: "Margherita Pizza",
      description: "Fresh mozzarella, basil, and tomato sauce.",
      category: "Entrees",
      priceCents: 1299,
      imageUrl: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80",
      sortOrder: 1
    },
    {
      name: "Classic Cheeseburger",
      description: "Cheddar, caramelized onions, toasted brioche.",
      category: "Entrees",
      priceCents: 1049,
      imageUrl: "https://images.unsplash.com/photo-1543352634-3e6556de59c0?auto=format&fit=crop&w=800&q=80",
      sortOrder: 2
    }
  ]);

  const [pizza, burger] = menuItems;

  const loyaltyDeals = await LoyaltyDeal.create([
    {
      title: "Weekend Brunch Duo",
      description: "Redeem for two brunch entrees and mimosas.",
      pointsRequired: 2000,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    },
    {
      title: "Chef's Counter Upgrade",
      description: "Upgrade to the chef's counter for your next reservation.",
      pointsRequired: 1250,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  ]);

  await CustomerDeal.create({
    customer: alex._id,
    deal: loyaltyDeals[0]._id
  });

  await LoyaltyTransaction.create([
    {
      customer: alex._id,
      pointsChange: 1620,
      description: "Chef's Tasting order"
    },
    {
      customer: alex._id,
      pointsChange: 320,
      description: "Referral bonus"
    }
  ]);

  await Order.create({
    customer: alex._id,
    totalCents: 16200,
    status: "completed",
    channel: "dine_in",
    items: [
      {
        menuItem: pizza._id,
        name: pizza.name,
        quantity: 2,
        unitPriceCents: pizza.priceCents
      },
      {
        menuItem: burger._id,
        name: burger.name,
        quantity: 1,
        unitPriceCents: burger.priceCents
      }
    ]
  });

  await Reservation.create({
    customer: alex._id,
    partySize: 2,
    reservationTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    status: "confirmed",
    notes: "Window seating"
  });

  const managerEmail = process.env.MANAGER_EMAIL || "manager@delicato.test";
  const managerPassword = process.env.MANAGER_PASSWORD || "ManageMe123!";
  const managerName = process.env.MANAGER_NAME || "Delicato Manager";
  const managerHash = await bcrypt.hash(managerPassword, 12);

  const customerEmail = process.env.CUSTOMER_EMAIL || alex.email;
  const customerPassword = process.env.CUSTOMER_PASSWORD || "GuestAccess123";
  const customerHash = await bcrypt.hash(customerPassword, 12);

  await User.create([
    {
      email: managerEmail,
      passwordHash: managerHash,
      role: "manager",
      name: managerName
    },
    {
      email: customerEmail,
      passwordHash: customerHash,
      role: "customer",
      name: `${alex.firstName} ${alex.lastName}`,
      customer: alex._id
    }
  ]);

  console.log(`Seeded manager account -> ${managerEmail} / ${managerPassword}`);
  console.log(`Seeded customer account -> ${customerEmail} / ${customerPassword}`);

  await mongoose.disconnect();
  console.log("Seed data inserted successfully.");
}

seed().catch((error) => {
  console.error("Seed failed", error);
  mongoose.disconnect();
  process.exit(1);
});
