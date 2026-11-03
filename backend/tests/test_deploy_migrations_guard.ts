// @ts-ignore
import { verifyPreFlightIndex } from '../scripts/deploy-migrations';
import path from 'path';

async function runDeployGuardTests() {
  console.log('================================================================');
  console.log('  DEPLOYMENT PRE-FLIGHT GUARD — AUTOMATED TEST SUITE            ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail ? `-> ${detail}` : '');
      failed++;
    }
  }

  const dummyMigrationsDir = path.resolve(__dirname, 'fixtures/migrations');
  const dummyPendingDir = path.resolve(__dirname, '../prisma/migrations');

  // Baseline healthy catalog mock record
  const healthyCatalogRow = {
    schema_name: 'public',
    table_name: 'customer_measurements',
    index_name: 'customer_measurements_tenant_customer_garment_key',
    access_method: 'btree',
    is_unique: true,
    is_valid: true,
    is_ready: true,
    total_attributes: 3,
    key_attributes: 3,
    has_exact_three_keys_no_include: true,
    is_not_partial: true,
    is_not_expression: true,
    key_column_names: ['tenantId', 'customerId', 'garmentTypeId']
  };

  // Test 1: Bypassed when target migration is not part of package
  {
    const mockPrisma: any = {
      $queryRaw: async () => []
    };
    const res = await verifyPreFlightIndex(mockPrisma, {
      migrationsDir: dummyMigrationsDir,
      targetMigration: 'non_existent_migration_folder'
    });
    assert(res.bypassed === true && res.reason === 'MIGRATION_NOT_IN_PACKAGE', 'Test 1: Guard bypasses check when migration is not in package');
  }

  // Test 2: Bypassed when target migration has already been applied in _prisma_migrations
  {
    const mockPrisma: any = {
      $queryRaw: async (query: any) => {
        // Query to check _prisma_migrations returns row
        return [{ id: 'mig-already-applied-id' }];
      }
    };
    const res = await verifyPreFlightIndex(mockPrisma, {
      migrationsDir: dummyPendingDir,
      targetMigration: '20260927000000_sync_schema_tables_and_columns' // existing applied migration
    });
    assert(res.bypassed === true && res.reason === 'ALREADY_APPLIED', 'Test 2: Guard bypasses check when migration is already applied in DB');
  }

  // Test 3: Guard passes when pending migration finds healthy 10-point index
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [healthyCatalogRow];
      }
    };
    const res = await verifyPreFlightIndex(mockPrisma, {
      migrationsDir: dummyPendingDir,
      targetMigration: '20260927000000_sync_schema_tables_and_columns' // using folder that exists
    });
    assert(res.verified === true && res.bypassed === false, 'Test 3: Guard passes when 10-point catalog inspection succeeds');
  }

  // Test 4: Guard throws error when index is missing completely (empty catalog)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return []; // missing index
      }
    };
    let threw = false;
    let errMsg = '';
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
      errMsg = e.message;
    }
    assert(threw === true, 'Test 4: Guard throws error when target index is missing in PostgreSQL');
    assert(errMsg.includes('PRE-FLIGHT REJECTED') && errMsg.includes('does not exist in PostgreSQL'), 'Test 4: Error message indicates missing index');
  }

  // Test 5: Guard throws error when index is invalid (indisvalid = false)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, is_valid: false }];
      }
    };
    let threw = false;
    let errMsg = '';
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
      errMsg = e.message;
    }
    assert(threw === true, 'Test 5: Guard throws error when target index is invalid (indisvalid = false)');
    assert(errMsg.includes('is_valid: false'), 'Test 5: Error message reports is_valid: false');
  }

  // Test 6: Guard throws error when index is not unique (indisunique = false)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, is_unique: false }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 6: Guard throws error when target index is not marked unique');
  }

  // Test 7: Guard throws error when index is not ready (indisready = false)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, is_ready: false }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 7: Guard throws error when target index is not ready (indisready = false)');
  }

  // Test 8: Guard throws error when key column ordering is scrambled
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, key_column_names: ['customerId', 'tenantId', 'garmentTypeId'] }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 8: Guard throws error when key columns order does not match [tenantId, customerId, garmentTypeId]');
  }

  // Test 9: Guard throws error when index contains unexpected INCLUDE columns
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, has_exact_three_keys_no_include: false, total_attributes: 4, key_attributes: 3 }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 9: Guard throws error when index has unexpected non-key INCLUDE columns');
  }

  // Test 10: Guard throws error when index is a partial index (is_not_partial = false)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, is_not_partial: false }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 10: Guard throws error when index has an unexpected partial predicate');
  }

  // Test 11: Guard throws error when index is an expression index (is_not_expression = false)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, is_not_expression: false }];
      }
    };
    let threw = false;
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
    }
    assert(threw === true, 'Test 11: Guard throws error when index has an unexpected functional expression');
  }

  // Test 12: Guard throws error when access method is not btree (e.g., hash or gin)
  {
    const mockPrisma: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        const text = strings.join(' ');
        if (text.includes('_prisma_migrations')) return [];
        return [{ ...healthyCatalogRow, access_method: 'hash' }];
      }
    };
    let threw = false;
    let errMsg = '';
    try {
      await verifyPreFlightIndex(mockPrisma, {
        migrationsDir: dummyPendingDir,
        targetMigration: '20260927000000_sync_schema_tables_and_columns'
      });
    } catch (e: any) {
      threw = true;
      errMsg = e.message;
    }
    assert(threw === true, 'Test 12: Guard throws error when index access method is not btree (access_method = hash)');
    assert(errMsg.includes('access_method: hash'), 'Test 12: Error message explicitly reports invalid access method');
  }

  console.log('\n================================================================');
  console.log(`  DEPLOYMENT GUARD RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeployGuardTests().catch((err) => {
  console.error('Fatal test error in deploy guard suite:', err);
  process.exit(1);
});
