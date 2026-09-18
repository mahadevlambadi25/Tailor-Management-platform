import { PrismaClient, RoleType, UnitSystem, OrderStatus, ProductionStageName, PaymentMethod, PaymentStatus, AppointmentType, AppointmentStatus, NotificationChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seed ---');

  // 1. Create Tenant 1: Royal Bespoke Tailors
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: 'royal-bespoke' },
    update: {},
    create: {
      name: 'Royal Bespoke Tailors',
      slug: 'royal-bespoke',
      phone: '+91 9876543210',
      email: 'contact@royalbespoke.com',
      address: '100 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      gstNumber: '29ABCDE1234F1Z5',
      defaultUnit: UnitSystem.INCHES,
      currency: 'INR'
    }
  });

  console.log('Tenant 1 created:', tenant1.name);

  // Subscription & Feature Flags
  await prisma.subscription.upsert({
    where: { tenantId: tenant1.id },
    update: {},
    create: {
      tenantId: tenant1.id,
      planName: 'ENTERPRISE_BESPOKE',
      status: 'ACTIVE',
      maxOrdersPerMonth: 5000,
      maxStaff: 100,
      maxBranches: 10
    }
  });

  await prisma.featureFlag.upsert({
    where: { tenantId_featureKey: { tenantId: tenant1.id, featureKey: 'WHATSAPP_INTEGRATION' } },
    update: {},
    create: { tenantId: tenant1.id, featureKey: 'WHATSAPP_INTEGRATION', isEnabled: true }
  });

  // Branches
  const mainBranch = await prisma.branch.upsert({
    where: { tenantId_name: { tenantId: tenant1.id, name: 'Main Workshop' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      name: 'Main Workshop',
      code: 'HQ-01',
      phone: '+91 80 22334455',
      address: '100 MG Road, Bangalore',
      isMain: true
    }
  });

  const boutiqueBranch = await prisma.branch.upsert({
    where: { tenantId_name: { tenantId: tenant1.id, name: 'Downtown Boutique' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      name: 'Downtown Boutique',
      code: 'DT-02',
      phone: '+91 80 99887766',
      address: '42 Commercial Street, Bangalore',
      isMain: false
    }
  });

  // Password hash for all test accounts: "Password@123"
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  // 2. Staff Users for all 10 Roles
  const usersData = [
    { email: 'owner@royalbespoke.com', name: 'Mahadev (Owner)', role: RoleType.SHOP_OWNER, branchId: mainBranch.id },
    { email: 'manager@royalbespoke.com', name: 'Ramesh Patel (Manager)', role: RoleType.MANAGER, branchId: mainBranch.id },
    { email: 'receptionist@royalbespoke.com', name: 'Anita Rao (Receptionist)', role: RoleType.RECEPTIONIST, branchId: boutiqueBranch.id },
    { email: 'tailor@royalbespoke.com', name: 'Mohan Lal (Master Tailor)', role: RoleType.TAILOR, branchId: mainBranch.id, skills: ['Suit Stitching', 'Shirt Fitting'] },
    { email: 'cutter@royalbespoke.com', name: 'Deepak Verma (Master Cutter)', role: RoleType.CUTTER, branchId: mainBranch.id, skills: ['Pattern Cutting', 'Canvas Layout'] },
    { email: 'finisher@royalbespoke.com', name: 'Sunil Das (Finisher)', role: RoleType.FINISHER, branchId: mainBranch.id, skills: ['Hand Buttonhole', 'Steam Ironing'] },
    { email: 'cashier@royalbespoke.com', name: 'Kavita Singh (Cashier)', role: RoleType.CASHIER, branchId: boutiqueBranch.id },
    { email: 'saas.admin@tailorpro.com', name: 'SaaS Platform Admin', role: RoleType.SAAS_OWNER, branchId: null }
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: u.email } },
      update: {},
      create: {
        tenantId: tenant1.id,
        branchId: u.branchId,
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash: defaultPasswordHash,
        skills: u.skills || []
      }
    });
  }

  // 3. Tenant 2: Elite Stitching Co (for cross-tenant isolation testing)
  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'elite-stitching' },
    update: {},
    create: {
      name: 'Elite Stitching Co',
      slug: 'elite-stitching',
      phone: '+91 9123456789',
      email: 'contact@elitestitching.com',
      address: '77 Residency Road',
      city: 'Bangalore',
      defaultUnit: UnitSystem.INCHES,
      currency: 'INR'
    }
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant2.id, email: 'owner@elitestitching.com' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      name: 'Vikram Elite (Owner)',
      email: 'owner@elitestitching.com',
      role: RoleType.SHOP_OWNER,
      passwordHash: defaultPasswordHash
    }
  });

  // 4. Garment Catalogue & Measurement Templates
  const garmentShirt = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'SHIRT' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'SHIRT',
      name: "Men's Classic Shirt",
      category: 'Men',
      defaultPrice: 1500
    }
  });

  const garmentPant = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'PANT' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'PANT',
      name: 'Formal Trousers / Pant',
      category: 'Men',
      defaultPrice: 1200
    }
  });

  const garmentBlouse = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'BLOUSE' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'BLOUSE',
      name: "Women's Designer Blouse",
      category: 'Women',
      defaultPrice: 1800
    }
  });

  // Template for Shirt
  const shirtTemplate = await prisma.measurementTemplate.create({
    data: {
      tenantId: tenant1.id,
      garmentTypeId: garmentShirt.id,
      name: 'Standard Shirt Template',
      unit: UnitSystem.INCHES,
      versions: {
        create: {
          versionNumber: 1,
          fields: [
            { key: 'Chest', label: 'Chest', min: 28, max: 60, required: true },
            { key: 'Waist', label: 'Waist', min: 24, max: 56, required: true },
            { key: 'Neck', label: 'Neck / Collar', min: 12, max: 22, required: true },
            { key: 'Sleeve', label: 'Sleeve Length', min: 18, max: 38, required: true },
            { key: 'Shoulder', label: 'Shoulder Width', min: 14, max: 26, required: true },
            { key: 'Length', label: 'Shirt Length', min: 24, max: 40, required: true }
          ]
        }
      }
    }
  });

  // Template for Pant
  const pantTemplate = await prisma.measurementTemplate.create({
    data: {
      tenantId: tenant1.id,
      garmentTypeId: garmentPant.id,
      name: 'Standard Pant Template',
      unit: UnitSystem.INCHES,
      versions: {
        create: {
          versionNumber: 1,
          fields: [
            { key: 'Waist', label: 'Waist', min: 24, max: 54, required: true },
            { key: 'Hip', label: 'Hip', min: 30, max: 60, required: true },
            { key: 'Inseam', label: 'Inseam Length', min: 20, max: 40, required: true },
            { key: 'Outseam', label: 'Outseam Length', min: 30, max: 50, required: true },
            { key: 'Thigh', label: 'Thigh', min: 16, max: 36, required: true },
            { key: 'Bottom', label: 'Bottom Hem Width', min: 10, max: 26, required: true }
          ]
        }
      }
    }
  });

  // 5. Style Library
  const styleCollar = await prisma.style.create({
    data: {
      tenantId: tenant1.id,
      garmentTypeId: garmentShirt.id,
      name: 'Mandarin Band Collar',
      category: 'Collar',
      description: 'Clean nehru / mandarin collar without flaps'
    }
  });

  const styleCuff = await prisma.style.create({
    data: {
      tenantId: tenant1.id,
      garmentTypeId: garmentShirt.id,
      name: 'French Double Cuff',
      category: 'Cuff',
      description: 'Formal double fold cuff for cufflinks'
    }
  });

  const stylePantPocket = await prisma.style.create({
    data: {
      tenantId: tenant1.id,
      garmentTypeId: garmentPant.id,
      name: 'Cross Slanted Pockets',
      category: 'Pocket',
      description: 'Classic side slanted trousers pocket'
    }
  });

  // 6. Customers
  // Master Acceptance Customer: Rajesh Kumar
  const customerRajesh = await prisma.customer.upsert({
    where: { tenantId_customerId: { tenantId: tenant1.id, customerId: 'CUST-10001' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      customerId: 'CUST-10001',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      mobile: '9876543210',
      email: 'rajesh.kumar@example.com',
      gender: 'Male',
      address: 'Flat 302, Palm Meadows, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      notes: 'VIP customer. Prefers slim fits and mother-of-pearl buttons.',
      preferences: {
        create: {
          tenantId: tenant1.id,
          preferredContactMethod: 'WHATSAPP',
          fabricPreferences: '100% Giza Cotton, Italian Linen',
          fitPreference: 'Slim fit',
          notes: 'Double stitched seams requested'
        }
      }
    }
  });

  // Save Measurements for Rajesh Kumar:
  // Shirt measurement (Version 1: Chest 40)
  const rajeshShirtMeasure = await prisma.customerMeasurement.create({
    data: {
      tenantId: tenant1.id,
      customerId: customerRajesh.id,
      garmentTypeId: garmentShirt.id,
      name: "Rajesh's Classic Shirt Measurement",
      unit: UnitSystem.INCHES,
      versions: {
        create: {
          versionNumber: 1,
          values: {
            Chest: 40,
            Waist: 34,
            Neck: 16,
            Sleeve: 25,
            Shoulder: 18,
            Length: 30
          },
          notes: 'Fitted at Indiranagar store'
        }
      }
    }
  });

  // Pant measurement (Version 1: Waist 34)
  const rajeshPantMeasure = await prisma.customerMeasurement.create({
    data: {
      tenantId: tenant1.id,
      customerId: customerRajesh.id,
      garmentTypeId: garmentPant.id,
      name: "Rajesh's Formal Trouser Measurement",
      unit: UnitSystem.INCHES,
      versions: {
        create: {
          versionNumber: 1,
          values: {
            Waist: 34,
            Hip: 40,
            Inseam: 31,
            Outseam: 41,
            Thigh: 24,
            Bottom: 15
          },
          notes: 'Half break bottom'
        }
      }
    }
  });

  // Customer 2: Priya Sharma (Women's Blouse customer)
  const customerPriya = await prisma.customer.upsert({
    where: { tenantId_customerId: { tenantId: tenant1.id, customerId: 'CUST-10002' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      customerId: 'CUST-10002',
      firstName: 'Priya',
      lastName: 'Sharma',
      mobile: '9845012345',
      email: 'priya.sharma@example.com',
      gender: 'Female',
      address: '24 Koramangala 4th Block',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      notes: 'Bridal wear blouse with zari embroidery'
    }
  });

  // 7. Master Acceptance Scenario Order:
  // Multi-item Shirt + Pant order for Rajesh Kumar
  // Total = 8,000, Discount = 500, Net = 7,500, Advance = 3,000, Balance = 4,500
  // Delivery Date = 20 September 2026
  const tailorUser = await prisma.user.findFirst({ where: { tenantId: tenant1.id, email: 'tailor@royalbespoke.com' } });

  const masterOrder = await prisma.order.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant1.id, orderNumber: 'ORD-2026-0001' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      branchId: mainBranch.id,
      orderNumber: 'ORD-2026-0001',
      customerId: customerRajesh.id,
      status: OrderStatus.DELIVERED,
      priority: 'URGENT',
      deliveryDate: new Date('2026-09-20T18:00:00Z'),
      totalAmount: 8000.00,
      discountType: 'FIXED',
      discountValue: 500.00,
      discountAmount: 500.00,
      netAmount: 7500.00,
      gstRate: 0.00,
      gstAmount: 0.00,
      paidAmount: 3000.00,
      balanceAmount: 4500.00,
      paymentStatus: PaymentStatus.PARTIAL,
      internalNotes: 'VIP Client - ensure double pressing before trial.',
      customerNotes: 'Ready for fitting before 20 September 2026.',
      items: {
        create: [
          {
            tenantId: tenant1.id,
            garmentTypeId: garmentShirt.id,
            itemPrice: 4000.00,
            stitchingCharge: 500.00,
            quantity: 1,
            totalItemPrice: 4500.00,
            status: ProductionStageName.DELIVERED,
            internalNotes: 'French cuff stitching pattern with collar stiffener.',
            measurementSnapshot: {
              create: {
                tenantId: tenant1.id,
                valuesSnapshot: {
                  Chest: 40,
                  Waist: 34,
                  Neck: 16,
                  Sleeve: 25,
                  Shoulder: 18,
                  Length: 30
                },
                unit: UnitSystem.INCHES,
                notes: 'Snapshot taken at order booking'
              }
            },
            styles: {
              create: [
                { tenantId: tenant1.id, styleId: styleCollar.id, selectedOptions: { spread: 'Standard' } },
                { tenantId: tenant1.id, styleId: styleCuff.id, selectedOptions: { buttons: 2 } }
              ]
            },
            productionJob: {
              create: {
                tenantId: tenant1.id,
                currentStage: ProductionStageName.DELIVERED,
                assignedToId: tailorUser?.id,
                assignedDate: new Date('2026-09-12T10:00:00Z'),
                startedDate: new Date('2026-09-13T09:00:00Z'),
                completedDate: new Date('2026-09-17T14:00:00Z'),
                notes: 'Finished and ironed to perfection.'
              }
            }
          },
          {
            tenantId: tenant1.id,
            garmentTypeId: garmentPant.id,
            itemPrice: 3500.00,
            quantity: 1,
            totalItemPrice: 3500.00,
            status: ProductionStageName.DELIVERED,
            measurementSnapshot: {
              create: {
                tenantId: tenant1.id,
                valuesSnapshot: {
                  Waist: 34,
                  Hip: 40,
                  Inseam: 31,
                  Outseam: 41,
                  Thigh: 24,
                  Bottom: 15
                },
                unit: UnitSystem.INCHES,
                notes: 'Snapshot taken at order booking'
              }
            },
            styles: {
              create: [
                { tenantId: tenant1.id, styleId: stylePantPocket.id }
              ]
            },
            productionJob: {
              create: {
                tenantId: tenant1.id,
                currentStage: ProductionStageName.DELIVERED,
                assignedToId: tailorUser?.id,
                assignedDate: new Date('2026-09-12T10:00:00Z'),
                startedDate: new Date('2026-09-13T09:00:00Z'),
                completedDate: new Date('2026-09-17T14:00:00Z')
              }
            }
          }
        ]
      },
      payments: {
        create: [
          {
            tenantId: tenant1.id,
            customerId: customerRajesh.id,
            amount: 3000.00,
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-987654321',
            notes: 'Advance booking payment'
          }
        ]
      }
    }
  });

  // Create receipt for the advance payment if not exists
  const advancePayment = await prisma.payment.findFirst({
    where: { tenantId: tenant1.id, orderId: masterOrder.id }
  });
  const existingReceipt = await prisma.receipt.findFirst({
    where: { tenantId: tenant1.id, receiptNumber: 'REC-2026-0001' }
  });
  if (!existingReceipt && advancePayment) {
    await prisma.receipt.create({
      data: {
        tenantId: tenant1.id,
        paymentId: advancePayment.id,
        receiptNumber: 'REC-2026-0001',
        amount: 3000.00
      }
    });
  }

  // Appointment for Rajesh Kumar if not exists
  const existingAppt = await prisma.appointment.findFirst({
    where: { tenantId: tenant1.id, customerId: customerRajesh.id }
  });
  if (!existingAppt) {
    await prisma.appointment.create({
      data: {
        tenantId: tenant1.id,
        branchId: mainBranch.id,
        customerId: customerRajesh.id,
        staffId: tailorUser?.id,
        type: AppointmentType.FITTING,
        scheduledAt: new Date('2026-09-18T11:00:00Z'),
        durationMinutes: 45,
        bufferMinutes: 15,
        status: AppointmentStatus.COMPLETED,
        notes: 'Initial fitting completed with minor waist adjustment'
      }
    });
  }

  console.log('Master acceptance scenario order seeded successfully: ORD-2026-0001');
  console.log('--- Database Seed Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
