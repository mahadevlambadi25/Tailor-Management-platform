import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { UnitSystem } from '@prisma/client';

export interface DefaultGarmentDef {
  code: string;
  name: string;
  category: string;
  defaultPrice: number;
  templateName: string;
  templateFields: Array<{
    key: string;
    label: string;
    min: number;
    max: number;
    required: boolean;
  }>;
  starterStyles: Array<{
    name: string;
    category: string;
    description: string;
  }>;
}

export const CANONICAL_GARMENT_CATALOG: DefaultGarmentDef[] = [
  {
    code: 'SHIRT',
    name: "Men's Classic Shirt",
    category: 'Men',
    defaultPrice: 1500,
    templateName: 'Standard Shirt Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 28, max: 60, required: true },
      { key: 'Waist', label: 'Waist', min: 24, max: 56, required: true },
      { key: 'Neck', label: 'Neck / Collar', min: 12, max: 22, required: true },
      { key: 'Sleeve', label: 'Sleeve Length', min: 18, max: 38, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 14, max: 26, required: true },
      { key: 'Length', label: 'Shirt Length', min: 24, max: 40, required: true }
    ],
    starterStyles: [
      { name: 'Formal Cutaway Collar', category: 'Collar', description: 'Wide spread cutaway collar suitable for formal tie and business attire.' },
      { name: 'Button Down Casual Collar', category: 'Collar', description: 'Classic Oxford button-down soft collar for casual shirts.' },
      { name: 'French Double Cuff', category: 'Cuff', description: 'Folded French cuff designed for cufflinks.' },
      { name: 'Single Rounded Barrel Cuff', category: 'Cuff', description: 'Standard everyday rounded single cuff with two buttons.' }
    ]
  },
  {
    code: 'PANT',
    name: 'Formal Trousers / Pant',
    category: 'Men',
    defaultPrice: 1200,
    templateName: 'Standard Trousers Template',
    templateFields: [
      { key: 'Waist', label: 'Waist', min: 24, max: 56, required: true },
      { key: 'Hip', label: 'Hip / Seat', min: 28, max: 64, required: true },
      { key: 'Inseam', label: 'Inseam Length', min: 22, max: 42, required: true },
      { key: 'Outseam', label: 'Outseam / Full Length', min: 32, max: 52, required: true },
      { key: 'Thigh', label: 'Thigh Width', min: 18, max: 36, required: true },
      { key: 'Bottom', label: 'Bottom / Hem Opening', min: 12, max: 24, required: true }
    ],
    starterStyles: [
      { name: 'Flat Front Slim Cut', category: 'Pleat', description: 'Contemporary flat front trousers without front pleats.' },
      { name: 'Single Forward Pleat', category: 'Pleat', description: 'Traditional single forward pleat providing comfort and classic drape.' },
      { name: 'Turn-up Cuffed Hem', category: 'Hem', description: '1.5-inch turn-up cuffed hem for weight and classic drape.' }
    ]
  },
  {
    code: 'SUIT',
    name: '2-Piece Bespoke Suit',
    category: 'Men',
    defaultPrice: 8500,
    templateName: 'Bespoke Suit Jacket Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 30, max: 62, required: true },
      { key: 'Waist', label: 'Jacket Waist', min: 26, max: 58, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 15, max: 26, required: true },
      { key: 'Sleeve', label: 'Sleeve Length', min: 20, max: 38, required: true },
      { key: 'Length', label: 'Jacket Length', min: 26, max: 42, required: true },
      { key: 'Hip', label: 'Hip / Seat', min: 30, max: 64, required: true }
    ],
    starterStyles: [
      { name: 'Classic Notch Lapel', category: 'Lapel', description: 'Timeless 3-inch notch lapel suitable for business and lounge suits.' },
      { name: 'Modern Peak Lapel', category: 'Lapel', description: 'Dashing upward-pointing peak lapel for power suits and evening wear.' },
      { name: 'Double Vented Back', category: 'Vent', description: 'English-style side vents for ease of movement and comfort while seated.' }
    ]
  },
  {
    code: 'KURTA',
    name: 'Traditional Kurta',
    category: 'Men',
    defaultPrice: 1800,
    templateName: 'Traditional Kurta Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 28, max: 60, required: true },
      { key: 'Waist', label: 'Waist', min: 24, max: 56, required: true },
      { key: 'Length', label: 'Kurta Length', min: 34, max: 50, required: true },
      { key: 'Sleeve', label: 'Sleeve Length', min: 20, max: 36, required: true },
      { key: 'Shoulder', label: 'Shoulder', min: 14, max: 26, required: true },
      { key: 'Neck', label: 'Neck / Collar', min: 13, max: 22, required: true }
    ],
    starterStyles: [
      { name: 'Mandarin / Band Collar', category: 'Collar', description: 'Neat stand-up mandarin collar with concealed or button placket.' },
      { name: 'Side Slit Straight Cut', category: 'Fit', description: 'Traditional straight silhouette with generous side slits.' }
    ]
  },
  {
    code: 'BLAZER',
    name: 'Tailored Blazer',
    category: 'Men',
    defaultPrice: 5500,
    templateName: 'Tailored Blazer Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 30, max: 60, required: true },
      { key: 'Waist', label: 'Waist', min: 26, max: 56, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 15, max: 25, required: true },
      { key: 'Sleeve', label: 'Sleeve Length', min: 20, max: 36, required: true },
      { key: 'Length', label: 'Blazer Length', min: 26, max: 40, required: true }
    ],
    starterStyles: [
      { name: '2-Button Single Breasted', category: 'Front', description: 'Versatile 2-button front closure with horn or metal buttons.' },
      { name: 'Patch Pockets', category: 'Pocket', description: 'Casual rounded patch pockets on hips.' }
    ]
  },
  {
    code: 'WAISTCOAT',
    name: 'Classic Waistcoat / Nehru Jacket',
    category: 'Men',
    defaultPrice: 2200,
    templateName: 'Waistcoat / Nehru Jacket Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 30, max: 58, required: true },
      { key: 'Waist', label: 'Waist', min: 26, max: 54, required: true },
      { key: 'Length', label: 'Front Length', min: 20, max: 32, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 13, max: 22, required: true }
    ],
    starterStyles: [
      { name: '5-Button V-Neck Waistcoat', category: 'Front', description: 'Classic five-button front with lower welt pockets.' },
      { name: 'Band Collar Nehru Jacket', category: 'Collar', description: 'Stand collar with straight cut and full button front.' }
    ]
  },
  {
    code: 'BLOUSE',
    name: "Women's Designer Blouse",
    category: 'Women',
    defaultPrice: 1800,
    templateName: 'Designer Blouse Template',
    templateFields: [
      { key: 'Bust', label: 'Bust', min: 28, max: 54, required: true },
      { key: 'Underbust', label: 'Underbust / Waist', min: 24, max: 48, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 11, max: 20, required: true },
      { key: 'FrontNeck', label: 'Front Neck Depth', min: 5, max: 12, required: true },
      { key: 'BackNeck', label: 'Back Neck Depth', min: 5, max: 15, required: true },
      { key: 'Length', label: 'Blouse Length', min: 12, max: 20, required: true }
    ],
    starterStyles: [
      { name: 'Princess Cut Seams', category: 'Pattern', description: 'Flattering princess seam cut providing structured fit.' },
      { name: 'Sweetheart Neckline', category: 'Neckline', description: 'Curved sweetheart neckline front with deep round back.' },
      { name: 'Back Hook with Dori Tie', category: 'Closure', description: 'Secure back closure with handmade tassels.' }
    ]
  },
  {
    code: 'SHERWANI',
    name: 'Royal Wedding Sherwani',
    category: 'Men',
    defaultPrice: 15000,
    templateName: 'Wedding Sherwani Template',
    templateFields: [
      { key: 'Chest', label: 'Chest', min: 32, max: 62, required: true },
      { key: 'Waist', label: 'Waist', min: 28, max: 58, required: true },
      { key: 'Length', label: 'Sherwani Length', min: 38, max: 52, required: true },
      { key: 'Shoulder', label: 'Shoulder Width', min: 16, max: 26, required: true },
      { key: 'Sleeve', label: 'Sleeve Length', min: 22, max: 38, required: true },
      { key: 'Neck', label: 'Neck / Collar', min: 14, max: 22, required: true }
    ],
    starterStyles: [
      { name: 'Royal Angrakha Overlap', category: 'Front', description: 'Regal overlapping asymmetric front with decorative loop ties.' },
      { name: 'Embroidered Mandarin Stand', category: 'Collar', description: 'Heavily embellished stand collar.' }
    ]
  }
];

/**
 * Idempotently provisions the standard garment catalog, measurement templates,
 * and starter style cuts for a specific tenant.
 *
 * CRITICAL SAAS GUARANTEES:
 * - Completely tenant-scoped (only inserts for tenantId).
 * - Idempotent: uses upsert so running multiple times never duplicates records.
 * - Does NOT create demo customers, demo orders, or demo payments.
 * - Preserves existing custom styles and garment types.
 */
export async function provisionDefaultGarmentsForTenant(tenantId: string): Promise<void> {
  logger.info(`[GARMENT_CATALOG] Provisioning default garment master catalog for tenant: ${tenantId}`);

  for (const def of CANONICAL_GARMENT_CATALOG) {
    // 1. Upsert Garment Type
    const garment = await prisma.garmentType.upsert({
      where: {
        tenantId_code: { tenantId, code: def.code }
      },
      update: {
        // Keep existing name/price if user customized it; only ensure active
        isActive: true
      },
      create: {
        tenantId,
        code: def.code,
        name: def.name,
        category: def.category,
        defaultPrice: def.defaultPrice,
        isActive: true
      }
    });

    // 2. Ensure default measurement template exists for this garment
    const existingTemplate = await prisma.measurementTemplate.findFirst({
      where: { tenantId, garmentTypeId: garment.id }
    });

    if (!existingTemplate) {
      await prisma.measurementTemplate.create({
        data: {
          tenantId,
          garmentTypeId: garment.id,
          name: def.templateName,
          unit: UnitSystem.INCHES,
          versions: {
            create: {
              versionNumber: 1,
              fields: def.templateFields
            }
          }
        }
      }).catch((err) => {
        logger.warn(`Failed to seed template for garment ${def.code}: ${err.message}`);
      });
    }

    // 3. Ensure starter style options exist for this garment
    for (const styleDef of def.starterStyles) {
      const existingStyle = await prisma.style.findFirst({
        where: {
          tenantId,
          garmentTypeId: garment.id,
          name: styleDef.name
        }
      });

      if (!existingStyle) {
        await prisma.style.create({
          data: {
            tenantId,
            garmentTypeId: garment.id,
            name: styleDef.name,
            category: styleDef.category,
            description: styleDef.description,
            isActive: true
          }
        }).catch((err) => {
          logger.warn(`Failed to seed style ${styleDef.name}: ${err.message}`);
        });
      }
    }
  }

  logger.info(`[GARMENT_CATALOG] Successfully provisioned ${CANONICAL_GARMENT_CATALOG.length} garment types for tenant: ${tenantId}`);
}
