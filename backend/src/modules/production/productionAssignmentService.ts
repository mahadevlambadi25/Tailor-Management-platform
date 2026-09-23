import { RoleType } from '@prisma/client';

export interface CraftAssignments {
  cutterId?: string | null;
  tailorId?: string | null;
  finisherId?: string | null;
}

export interface EnrichedStaff {
  id: string;
  name: string;
  role: RoleType;
  phone?: string | null;
}

export interface EnrichedAssignments {
  cutter: EnrichedStaff | null;
  tailor: EnrichedStaff | null;
  finisher: EnrichedStaff | null;
}

export interface ParsedJobNotes {
  userNotes: string;
  assignments: CraftAssignments;
}

export class ProductionAssignmentService {
  /**
   * Safely parses raw notes string from ProductionJob.
   * If notes contain JSON with assignments, extracts both user notes and craft assignments.
   * If notes contain legacy plain text, leaves assignments empty and userNotes intact.
   */
  static parseNotesAndAssignments(rawNotes: string | null | undefined): ParsedJobNotes {
    if (!rawNotes || !rawNotes.trim()) {
      return {
        userNotes: '',
        assignments: { cutterId: null, tailorId: null, finisherId: null }
      };
    }

    try {
      const parsed = JSON.parse(rawNotes);
      if (typeof parsed === 'object' && parsed !== null) {
        // If structured metadata object: { userNotes, assignments: { cutterId, tailorId, finisherId } }
        if (parsed.assignments) {
          return {
            userNotes: typeof parsed.userNotes === 'string' ? parsed.userNotes : '',
            assignments: {
              cutterId: parsed.assignments.cutterId || null,
              tailorId: parsed.assignments.tailorId || null,
              finisherId: parsed.assignments.finisherId || null
            }
          };
        }

        // Direct assignments object: { cutterId, tailorId, finisherId, userNotes }
        if ('cutterId' in parsed || 'tailorId' in parsed || 'finisherId' in parsed) {
          return {
            userNotes: typeof parsed.userNotes === 'string' ? parsed.userNotes : (parsed.notes || ''),
            assignments: {
              cutterId: parsed.cutterId || null,
              tailorId: parsed.tailorId || null,
              finisherId: parsed.finisherId || null
            }
          };
        }
      }
    } catch {
      // Not JSON; legacy plain text notes. Preserve directly.
    }

    return {
      userNotes: rawNotes,
      assignments: { cutterId: null, tailorId: null, finisherId: null }
    };
  }

  /**
   * Serializes user notes and craft assignments into a structured JSON string.
   */
  static serializeNotesAndAssignments(
    userNotes: string | null | undefined,
    assignments: CraftAssignments
  ): string {
    const payload = {
      userNotes: (userNotes || '').trim(),
      assignments: {
        cutterId: assignments.cutterId || null,
        tailorId: assignments.tailorId || null,
        finisherId: assignments.finisherId || null
      }
    };
    return JSON.stringify(payload);
  }

  /**
   * Validates whether a user's role is compatible with the requested craft role.
   * Cutters must have role CUTTER (or SHOP_OWNER/MANAGER).
   * Tailors must have role TAILOR (or SHOP_OWNER/MANAGER).
   * Finishers must have role FINISHER (or SHOP_OWNER/MANAGER).
   */
  static validateCraftsmanRole(
    user: { id: string; name: string; role: RoleType },
    targetRole: 'CUTTER' | 'TAILOR' | 'FINISHER'
  ): { valid: boolean; error?: string } {
    const isOwnerOrManager = user.role === RoleType.SHOP_OWNER || user.role === RoleType.MANAGER;

    if (targetRole === 'CUTTER') {
      if (user.role === RoleType.CUTTER || isOwnerOrManager) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Staff "${user.name}" has role ${user.role} and cannot be assigned as CUTTER.`
      };
    }

    if (targetRole === 'TAILOR') {
      if (user.role === RoleType.TAILOR || isOwnerOrManager) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Staff "${user.name}" has role ${user.role} and cannot be assigned as TAILOR.`
      };
    }

    if (targetRole === 'FINISHER') {
      if (user.role === RoleType.FINISHER || isOwnerOrManager) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Staff "${user.name}" has role ${user.role} and cannot be assigned as FINISHER.`
      };
    }

    return { valid: true };
  }

  /**
   * Enriches a job object with populated craft assignments from a staff lookup map.
   */
  static enrichJobWithAssignments(job: any, staffMap: Map<string, EnrichedStaff>): any {
    const { userNotes, assignments } = this.parseNotesAndAssignments(job.notes);

    const enriched: EnrichedAssignments = {
      cutter: assignments.cutterId ? staffMap.get(assignments.cutterId) || null : null,
      tailor: assignments.tailorId ? staffMap.get(assignments.tailorId) || null : null,
      finisher: assignments.finisherId ? staffMap.get(assignments.finisherId) || null : null
    };

    return {
      ...job,
      userNotes,
      assignments: enriched,
      rawAssignments: assignments
    };
  }
}
