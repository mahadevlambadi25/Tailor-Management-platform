import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import bcrypt from 'bcryptjs';
import {
  RoleType,
  UnitSystem,
  OrderStatus,
  ProductionStageName,
  PaymentMethod,
  PaymentStatus,
  AppointmentType,
  AppointmentStatus
} from '@prisma/client';

export interface DemoPurgeResult {
  deletedOrdersCount: number;
  deletedAppointmentsCount: number;
  deletedInventoryCount: number;
  deletedCustomersCount: number;
}

export interface DemoStatsResult {
  demoOrdersCount: number;
  demoCustomersCount: number;
  demoAppointmentsCount: number;
  demoInventoryCount: number;
  hasDemoData: boolean;
}

/**
 * Transactionally purges ONLY records explicitly flagged with isDemo: true
 * belonging strictly to the specified tenant.
 *
 * CRITICAL SAFETY GUARANTEES:
 * - Tenant / shop record is NEVER deleted.
 * - Subscription record is NEVER deleted.
 * - Staff user accounts (Owner, Manager, Tailor, Cutter, etc.) are NEVER deleted.
 * - Real customers (isDemo: false) and real orders (isDemo: false) are NEVER touched.
 * - Other tenants' data is NEVER touched.
 * - Completely transactional: if any step fails, entire operation rolls back.
 */
export async function purgeTenantDemoData(tenantId: string): Promise<DemoPurgeResult> {
  logger.info(`[DEMO_PURGE] Starting atomic demo data cleanup for tenant: ${tenantId}`);

  try {
    const purgeResult = await prisma.$transaction(async (tx) => {
      // 1. Delete all demo orders
      // Cascades: order_items, order_item_measurements, order_item_styles, order_item_photos,
      // production_jobs, production_stage_history, trials, alterations, payments, receipts, invoices
      const deletedOrders = await tx.order.deleteMany({
        where: { tenantId, isDemo: true }
      });

      // 2. Delete demo appointments
      const deletedAppointments = await tx.appointment.deleteMany({
        where: { tenantId, isDemo: true }
      });

      // 3. Delete demo inventory items
      const deletedInventory = await tx.inventoryItem.deleteMany({
        where: { tenantId, isDemo: true }
      });

      // 4. Delete demo customers
      // Cascades: customer_measurements, measurement_versions, customer_preferences,
      // customer_styles, customer_photos, customer_documents
      const deletedCustomers = await tx.customer.deleteMany({
        where: { tenantId, isDemo: true }
      });

      // 5. If tenant was marked as demo, transition tenant to production (isDemo: false)
      await tx.tenant.update({
        where: { id: tenantId },
        data: { isDemo: false }
      }).catch(() => {
        // Ignored if already false or tenant not found
      });

      return {
        deletedOrdersCount: deletedOrders.count,
        deletedAppointmentsCount: deletedAppointments.count,
        deletedInventoryCount: deletedInventory.count,
        deletedCustomersCount: deletedCustomers.count
      };
    });

    logger.info(`[DEMO_PURGE] Demo purge successful for tenant ${tenantId}: ` +
      `${purgeResult.deletedOrdersCount} orders, ` +
      `${purgeResult.deletedAppointmentsCount} appointments, ` +
      `${purgeResult.deletedInventoryCount} inventory items, ` +
      `${purgeResult.deletedCustomersCount} customers deleted.`);

    return purgeResult;
  } catch (error: any) {
    logger.error(`[DEMO_PURGE_ERROR] Failed to purge demo data for tenant ${tenantId}: ${error.message}`, error);
    throw error;
  }
}

/**
 * Queries the count of active demo records for a tenant.
 */
export async function getDemoStats(tenantId: string): Promise<DemoStatsResult> {
  const [demoOrdersCount, demoCustomersCount, demoAppointmentsCount, demoInventoryCount] = await Promise.all([
    prisma.order.count({ where: { tenantId, isDemo: true } }),
    prisma.customer.count({ where: { tenantId, isDemo: true } }),
    prisma.appointment.count({ where: { tenantId, isDemo: true } }),
    prisma.inventoryItem.count({ where: { tenantId, isDemo: true } })
  ]);

  return {
    demoOrdersCount,
    demoCustomersCount,
    demoAppointmentsCount,
    demoInventoryCount,
    hasDemoData: demoOrdersCount > 0 || demoCustomersCount > 0 || demoAppointmentsCount > 0 || demoInventoryCount > 0
  };
}

/**
 * Creates realistic, complete demo data for a tenant:
 * - 2 workshop branches
 * - 7 staff roles (Owner, Manager, Receptionist, Tailor, Cutter, Finisher, Cashier)
 * - 6 inventory items (Fabrics, Buttons, Threads, Canvas)
 * - Garment Types & Measurement Templates (Suit, Shirt, Pant, Blouse)
 * - Style catalog options
 * - 3 Demo Customers with measurements and preferences (isDemo: true)
 * - 3 Multi-stage Demo Orders with items, snapshots, styles, and jobs (isDemo: true)
 * - Payments, Receipts, and Fitting Appointments (isDemo: true)
 */
export async function seedDemoDataForTenant(tenantId: string, options: { clearExisting?: boolean } = {}) {
  logger.info(`[DEMO_SEED] Seeding realistic demo data for tenant: ${tenantId}`);

  if (options.clearExisting) {
    await purgeTenantDemoData(tenantId);
  }

  // 1. Ensure Branches exist
  let mainBranch = await prisma.branch.findFirst({
    where: { tenantId, isMain: true }
  });
  if (!mainBranch) {
    mainBranch = await prisma.branch.create({
      data: {
        tenantId,
        name: 'Main Workshop Atelier',
        code: 'HQ-01',
        phone: '+91 80 22334455',
        address: '100 MG Road, Central Atelier',
        isMain: true
      }
    });
  }

  let boutiqueBranch = await prisma.branch.findFirst({
    where: { tenantId, name: 'Downtown Boutique' }
  });
  if (!boutiqueBranch) {
    boutiqueBranch = await prisma.branch.create({
      data: {
        tenantId,
        name: 'Downtown Boutique',
        code: 'DT-02',
        phone: '+91 80 99887766',
        address: '42 Commercial Street',
        isMain: false
      }
    });
  }

  // 2. Ensure Staff Users for all 7 required roles exist
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const tenantSlug = tenant?.slug || 'demo';

  const requiredStaff = [
    { email: `owner@${tenantSlug}.com`, name: 'Atelier Owner', role: RoleType.SHOP_OWNER, branchId: mainBranch.id },
    { email: `manager@${tenantSlug}.com`, name: 'Atelier Production Manager', role: RoleType.MANAGER, branchId: mainBranch.id },
    { email: `receptionist@${tenantSlug}.com`, name: 'Front Desk Receptionist', role: RoleType.RECEPTIONIST, branchId: boutiqueBranch.id },
    { email: `tailor@${tenantSlug}.com`, name: 'Master Tailor Mohan', role: RoleType.TAILOR, branchId: mainBranch.id, skills: ['Suit Tailoring', 'Canvas Construction'] },
    { email: `cutter@${tenantSlug}.com`, name: 'Master Cutter Deepak', role: RoleType.CUTTER, branchId: mainBranch.id, skills: ['Pattern Drafting', 'Fabric Cutting'] },
    { email: `finisher@${tenantSlug}.com`, name: 'Artisan Finisher Sunil', role: RoleType.FINISHER, branchId: mainBranch.id, skills: ['Hand Buttonhole', 'Steam Pressing'] },
    { email: `cashier@${tenantSlug}.com`, name: 'Atelier Cashier Kavita', role: RoleType.CASHIER, branchId: boutiqueBranch.id }
  ];

  const createdStaffUsers: Record<string, any> = {};
  for (const s of requiredStaff) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: s.email } },
      update: { branchId: s.branchId, skills: s.skills || [] },
      create: {
        tenantId,
        branchId: s.branchId,
        email: s.email,
        name: s.name,
        role: s.role,
        passwordHash: defaultPasswordHash,
        skills: s.skills || []
      }
    });
    createdStaffUsers[s.role] = user;
  }

  // 3. Ensure Garment Types
  const garmentSuit = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId, code: 'SUIT' } },
    update: {},
    create: {
      tenantId,
      code: 'SUIT',
      name: '2-Piece Bespoke Lounge Suit',
      category: 'Men',
      defaultPrice: 12000
    }
  });

  const garmentShirt = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId, code: 'SHIRT' } },
    update: {},
    create: {
      tenantId,
      code: 'SHIRT',
      name: 'Executive Bespoke Shirt',
      category: 'Men',
      defaultPrice: 2500
    }
  });

  const garmentPant = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId, code: 'PANT' } },
    update: {},
    create: {
      tenantId,
      code: 'PANT',
      name: 'Hand-Crafted Formal Trousers',
      category: 'Men',
      defaultPrice: 3000
    }
  });

  const garmentBlouse = await prisma.garmentType.upsert({
    where: { tenantId_code: { tenantId, code: 'BLOUSE' } },
    update: {},
    create: {
      tenantId,
      code: 'BLOUSE',
      name: 'Designer Embroidered Silk Blouse',
      category: 'Women',
      defaultPrice: 4500
    }
  });

  // 4. Ensure Style Options
  let styleLapel = await prisma.style.findFirst({ where: { tenantId, name: 'Peak Lapel (Bespoke)' } });
  if (!styleLapel) {
    styleLapel = await prisma.style.create({
      data: {
        tenantId,
        garmentTypeId: garmentSuit.id,
        name: 'Peak Lapel (Bespoke)',
        category: 'Lapel',
        description: 'Classical peak lapels hand-padded with canvas interfacing'
      }
    });
  }

  let styleCollar = await prisma.style.findFirst({ where: { tenantId, name: 'French Band Mandarin' } });
  if (!styleCollar) {
    styleCollar = await prisma.style.create({
      data: {
        tenantId,
        garmentTypeId: garmentShirt.id,
        name: 'French Band Mandarin',
        category: 'Collar',
        description: 'Clean nehru / mandarin band collar'
      }
    });
  }

  let styleCuff = await prisma.style.findFirst({ where: { tenantId, name: 'Double French Cuff' } });
  if (!styleCuff) {
    styleCuff = await prisma.style.create({
      data: {
        tenantId,
        garmentTypeId: garmentShirt.id,
        name: 'Double French Cuff',
        category: 'Cuff',
        description: 'Double fold cuffs tailored for silver cufflinks'
      }
    });
  }

  // 5. Create Realistic Inventory Items with isDemo: true
  const inventoryItemsData = [
    {
      itemCode: 'FAB-LINEN-001',
      name: 'Pure Italian Linen (Navy Blue)',
      category: 'FABRIC',
      quantity: 45.5,
      unit: 'METERS',
      unitPrice: 1800,
      reorderLevel: 10,
      supplier: 'Milano Textiles SpA'
    },
    {
      itemCode: 'FAB-COTTON-002',
      name: 'Egyptian Giza Cotton 120s (Crisp White)',
      category: 'FABRIC',
      quantity: 60.0,
      unit: 'METERS',
      unitPrice: 950,
      reorderLevel: 15,
      supplier: 'Cairo Mills'
    },
    {
      itemCode: 'FAB-WOOL-003',
      name: 'Super 130s Merino Wool (Charcoal Grey)',
      category: 'FABRIC',
      quantity: 32.0,
      unit: 'METERS',
      unitPrice: 3200,
      reorderLevel: 8,
      supplier: 'Yorkshire Weavers Ltd'
    },
    {
      itemCode: 'ACC-BUTTON-001',
      name: 'Natural Horn Buttons (Set of 24)',
      category: 'BUTTON',
      quantity: 150,
      unit: 'PIECES',
      unitPrice: 350,
      reorderLevel: 25,
      supplier: 'Artisan Buttons Co'
    },
    {
      itemCode: 'ACC-THREAD-001',
      name: 'Silk Stitching Thread Spools (Assorted)',
      category: 'THREAD',
      quantity: 75,
      unit: 'ROUNDS',
      unitPrice: 120,
      reorderLevel: 20,
      supplier: 'Coats Silk Thread'
    },
    {
      itemCode: 'ACC-CANVAS-001',
      name: 'Horsehair Chest Canvas Interfacing',
      category: 'CANVAS',
      quantity: 25.0,
      unit: 'METERS',
      unitPrice: 650,
      reorderLevel: 5,
      supplier: 'Bespoke Canvas Supplies'
    }
  ];

  for (const item of inventoryItemsData) {
    await prisma.inventoryItem.upsert({
      where: { tenantId_itemCode: { tenantId, itemCode: item.itemCode } },
      update: { isDemo: true, quantity: item.quantity, unitPrice: item.unitPrice },
      create: {
        tenantId,
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        reorderLevel: item.reorderLevel,
        supplier: item.supplier,
        notes: 'Seeded demo inventory item for complete atelier testing',
        isDemo: true
      }
    });
  }

  // 6. Create Demo Customers (isDemo: true)
  const cust1 = await prisma.customer.upsert({
    where: { tenantId_customerId: { tenantId, customerId: 'DEMO-1001' } },
    update: { isDemo: true },
    create: {
      tenantId,
      customerId: 'DEMO-1001',
      firstName: 'Vikramaditya',
      lastName: 'Rao',
      mobile: '9988776655',
      email: 'vikram.rao@demo.internal',
      gender: 'Male',
      city: 'Bangalore',
      state: 'Karnataka',
      address: '45 Lavelle Road',
      pincode: '560001',
      notes: 'VIP bespoke client testing tailoring workflow',
      isDemo: true,
      preferences: {
        create: {
          tenantId,
          preferredContactMethod: 'WHATSAPP',
          fabricPreferences: '100% Giza Cotton, Italian Linen',
          fitPreference: 'Slim fit',
          notes: 'Hand-sewn pick stitching on lapels'
        }
      }
    }
  });

  const cust2 = await prisma.customer.upsert({
    where: { tenantId_customerId: { tenantId, customerId: 'DEMO-1002' } },
    update: { isDemo: true },
    create: {
      tenantId,
      customerId: 'DEMO-1002',
      firstName: 'Ananya',
      lastName: 'Deshmukh',
      mobile: '9876540011',
      email: 'ananya.deshmukh@demo.internal',
      gender: 'Female',
      city: 'Bangalore',
      state: 'Karnataka',
      address: '12 Indiranagar 100ft Road',
      pincode: '560038',
      notes: 'Bridal couture sample client',
      isDemo: true
    }
  });

  const cust3 = await prisma.customer.upsert({
    where: { tenantId_customerId: { tenantId, customerId: 'DEMO-1003' } },
    update: { isDemo: true },
    create: {
      tenantId,
      customerId: 'DEMO-1003',
      firstName: 'Karthik',
      lastName: 'Subramanian',
      mobile: '9845099887',
      email: 'karthik.subramanian@demo.internal',
      gender: 'Male',
      city: 'Bangalore',
      state: 'Karnataka',
      address: '88 Jayanagar 4th Block',
      pincode: '560011',
      notes: 'Corporate formal wardrobe testing',
      isDemo: true
    }
  });

  // 7. Create Demo Customer Measurements
  const existingMeasure1 = await prisma.customerMeasurement.findFirst({
    where: { tenantId, customerId: cust1.id, garmentTypeId: garmentSuit.id }
  });
  if (!existingMeasure1) {
    await prisma.customerMeasurement.create({
      data: {
        tenantId,
        customerId: cust1.id,
        garmentTypeId: garmentSuit.id,
        name: "Vikram's Bespoke Suit Dimensions",
        unit: UnitSystem.INCHES,
        versions: {
          create: {
            versionNumber: 1,
            values: { Chest: 42, Waist: 36, Neck: 16.5, Sleeve: 26, Shoulder: 19, Length: 31 },
            notes: 'Master tailored fit profile'
          }
        }
      }
    });
  }

  // 8. Create Demo Orders with items, snapshots, jobs, payments, and isDemo: true
  // Order 1: 2-Piece Bespoke Suit for Vikramaditya Rao
  const existingOrder1 = await prisma.order.findUnique({
    where: { tenantId_orderNumber: { tenantId, orderNumber: 'DEMO-ORD-9001' } }
  });
  if (!existingOrder1) {
    await prisma.order.create({
      data: {
        tenantId,
        branchId: mainBranch.id,
        customerId: cust1.id,
        orderNumber: 'DEMO-ORD-9001',
        status: OrderStatus.IN_PROGRESS,
        priority: 'URGENT',
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        totalAmount: 12000,
        discountType: 'FIXED',
        discountValue: 1000,
        discountAmount: 1000,
        netAmount: 11000,
        paidAmount: 6000,
        balanceAmount: 5000,
        paymentStatus: PaymentStatus.PARTIAL,
        internalNotes: 'Premium bespoke suit with canvas padding and Italian horn buttons',
        customerNotes: 'Deliver before weekend formal event',
        isDemo: true,
        items: {
          create: {
            tenantId,
            garmentTypeId: garmentSuit.id,
            itemPrice: 12000,
            totalItemPrice: 11000,
            quantity: 1,
            status: ProductionStageName.STITCHING,
            internalNotes: 'Hand pad-stitched lapels with floating horsehair canvas',
            measurementSnapshot: {
              create: {
                tenantId,
                unit: UnitSystem.INCHES,
                valuesSnapshot: { Chest: 42, Waist: 36, Neck: 16.5, Sleeve: 26, Shoulder: 19, Length: 31 }
              }
            },
            styles: {
              create: {
                tenantId,
                styleId: styleLapel.id
              }
            },
            productionJob: {
              create: {
                tenantId,
                currentStage: ProductionStageName.STITCHING,
                assignedToId: createdStaffUsers[RoleType.TAILOR]?.id || null,
                assignedDate: new Date(),
                startedDate: new Date(),
                notes: 'Jacket stitching in progress at master workstation'
              }
            }
          }
        },
        payments: {
          create: {
            tenantId,
            customerId: cust1.id,
            amount: 6000,
            paymentMethod: PaymentMethod.UPI,
            referenceNumber: 'UPI-DEMO-9001',
            notes: 'Advance booking deposit',
            receipts: {
              create: {
                tenantId,
                receiptNumber: 'REC-DEMO-9001',
                amount: 6000
              }
            }
          }
        }
      }
    });
  }

  // Order 2: Silk Blouse for Ananya Deshmukh
  const existingOrder2 = await prisma.order.findUnique({
    where: { tenantId_orderNumber: { tenantId, orderNumber: 'DEMO-ORD-9002' } }
  });
  if (!existingOrder2) {
    const order2 = await prisma.order.create({
      data: {
        tenantId,
        branchId: boutiqueBranch.id,
        customerId: cust2.id,
        orderNumber: 'DEMO-ORD-9002',
        status: OrderStatus.TRIAL_PENDING,
        priority: 'REGULAR',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        totalAmount: 4500,
        netAmount: 4500,
        paidAmount: 4500,
        balanceAmount: 0,
        paymentStatus: PaymentStatus.PAID,
        internalNotes: 'Raw silk blouse with golden zardozi embroidery',
        customerNotes: 'Ready for trial fitting',
        isDemo: true,
        items: {
          create: {
            tenantId,
            garmentTypeId: garmentBlouse.id,
            itemPrice: 4500,
            totalItemPrice: 4500,
            quantity: 1,
            status: ProductionStageName.TRIAL,
            measurementSnapshot: {
              create: {
                tenantId,
                unit: UnitSystem.INCHES,
                valuesSnapshot: { Bust: 36, Waist: 30, Shoulder: 14.5, Length: 15 }
              }
            },
            productionJob: {
              create: {
                tenantId,
                currentStage: ProductionStageName.TRIAL,
                notes: 'Awaiting customer fitting trial'
              }
            }
          }
        },
        payments: {
          create: {
            tenantId,
            customerId: cust2.id,
            amount: 4500,
            paymentMethod: PaymentMethod.CARD,
            referenceNumber: 'CARD-DEMO-9002',
            notes: 'Full payment completed'
          }
        }
      }
    });

    // Create a Trial record for Order 2 item
    const order2Item = await prisma.orderItem.findFirst({ where: { orderId: order2.id } });
    if (order2Item) {
      await prisma.trial.create({
        data: {
          tenantId,
          orderItemId: order2Item.id,
          customerId: cust2.id,
          trialNumber: 1,
          scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          status: 'SCHEDULED',
          fitNotes: 'Check armhole clearance and neckline contour'
        }
      });
    }
  }

  // Order 3: Formal Business Shirt for Karthik Subramanian
  const existingOrder3 = await prisma.order.findUnique({
    where: { tenantId_orderNumber: { tenantId, orderNumber: 'DEMO-ORD-9003' } }
  });
  if (!existingOrder3) {
    await prisma.order.create({
      data: {
        tenantId,
        branchId: mainBranch.id,
        customerId: cust3.id,
        orderNumber: 'DEMO-ORD-9003',
        status: OrderStatus.RECEIVED,
        priority: 'REGULAR',
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        totalAmount: 3500,
        netAmount: 3500,
        paidAmount: 1500,
        balanceAmount: 2000,
        paymentStatus: PaymentStatus.PARTIAL,
        internalNotes: 'Egyptian cotton white formal business shirt',
        customerNotes: 'French cuff requested',
        isDemo: true,
        items: {
          create: {
            tenantId,
            garmentTypeId: garmentShirt.id,
            itemPrice: 3500,
            totalItemPrice: 3500,
            quantity: 1,
            status: ProductionStageName.CUTTING,
            measurementSnapshot: {
              create: {
                tenantId,
                unit: UnitSystem.INCHES,
                valuesSnapshot: { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25, Shoulder: 18, Length: 30 }
              }
            },
            styles: {
              create: [
                { tenantId, styleId: styleCollar.id },
                { tenantId, styleId: styleCuff.id }
              ]
            },
            productionJob: {
              create: {
                tenantId,
                currentStage: ProductionStageName.CUTTING,
                assignedToId: createdStaffUsers[RoleType.CUTTER]?.id || null,
                notes: 'Pattern drafted on fabric'
              }
            }
          }
        },
        payments: {
          create: {
            tenantId,
            customerId: cust3.id,
            amount: 1500,
            paymentMethod: PaymentMethod.CASH,
            referenceNumber: 'CASH-DEMO-9003',
            notes: 'Cash advance collected'
          }
        }
      }
    });
  }

  // 9. Demo Appointments with isDemo: true
  const existingAppt = await prisma.appointment.findFirst({
    where: { tenantId, customerId: cust1.id, isDemo: true }
  });
  if (!existingAppt) {
    await prisma.appointment.create({
      data: {
        tenantId,
        branchId: mainBranch.id,
        customerId: cust1.id,
        staffId: createdStaffUsers[RoleType.TAILOR]?.id || null,
        type: AppointmentType.TRIAL,
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        durationMinutes: 45,
        status: AppointmentStatus.SCHEDULED,
        notes: 'First trial fitting for 2-Piece bespoke suit',
        isDemo: true
      }
    });
  }

  const stats = await getDemoStats(tenantId);
  logger.info(`[DEMO_SEED] Demo data seeded successfully for tenant ${tenantId}. Active stats: ${JSON.stringify(stats)}`);
  return stats;
}

/**
 * Ensures an identifiable Demo Tenant exists (slug: 'demo-tailors', isDemo: true)
 * and seeds it with complete demo data.
 */
export async function seedIdentifiableDemoTenant(slug: string = 'demo-tailors') {
  logger.info(`[DEMO_TENANT] Ensuring identifiable demo tenant exists (slug: ${slug})...`);

  const demoTenant = await prisma.tenant.upsert({
    where: { slug },
    update: { isDemo: true },
    create: {
      name: 'Demo Bespoke Tailor Atelier',
      slug,
      phone: '+91 9876543210',
      email: `contact@${slug}.internal`,
      address: '77 Heritage Boulevard, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      gstNumber: '29DEMO1234F1Z9',
      defaultUnit: UnitSystem.INCHES,
      currency: 'INR',
      isDemo: true
    }
  });

  // Ensure trial subscription
  await prisma.subscription.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      planName: 'BESPOKE_PRO_TRIAL',
      status: 'TRIAL',
      maxOrdersPerMonth: 500,
      maxStaff: 25,
      maxBranches: 3
    }
  });

  // Seed demo records into this tenant
  const stats = await seedDemoDataForTenant(demoTenant.id);
  logger.info(`[DEMO_TENANT] Identifiable demo tenant ready. ID: ${demoTenant.id}, Slug: ${demoTenant.slug}`);

  return {
    tenant: demoTenant,
    stats
  };
}
