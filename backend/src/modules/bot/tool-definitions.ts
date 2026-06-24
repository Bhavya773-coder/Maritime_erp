import { z } from 'zod';
import { Role } from '@prisma/client';

export interface ToolDefinition {
  name: string;
  description: string;
  paramsSchema: z.ZodObject<any>;
  permissionCheck: (userRole: Role) => boolean;
  requiresConfirmation: boolean;
  idempotent: boolean;
  examples: { params: Record<string, any>; result: string }[];
}

const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM');
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullable().optional();
const NonEmptyString = z.string().min(1);

const isManagement = (role: Role) =>
  role === Role.OWNER || role === Role.MANAGER || role === Role.FLEET_MANAGER || role === Role.ACCOUNTS;

const isOwner = (role: Role) => role === Role.OWNER;

const allRoles = (_role: Role) => true;

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  searchUsers: {
    name: 'searchUsers',
    description: 'Find users by name, department, or role. Use when the user asks about staff members.',
    paramsSchema: z.object({
      query: NonEmptyString.describe('Search query: name, department, or role'),
      limit: z.number().int().min(1).max(20).default(10).describe('Maximum number of results'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { query: 'Dhaval', limit: 5 }, result: 'Found Dhaval Joisar (STAFF, Operations)' },
    ],
  },

  searchAssets: {
    name: 'searchAssets',
    description: 'Find vessels/barges/tugs by name, type, or status.',
    paramsSchema: z.object({
      query: NonEmptyString.describe('Vessel name or search term'),
      type: z.enum(['BARGE', 'TUG']).optional().describe('Filter by vessel type'),
      status: z.enum(['ACTIVE', 'IN_PORT', 'MAINTENANCE', 'NON_COMPLIANT']).optional().describe('Filter by status'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { query: 'KB-26', type: 'BARGE' }, result: 'KB 26 — BARGE, ACTIVE, Location: Dahej' },
    ],
  },

  getAssetDetails: {
    name: 'getAssetDetails',
    description: 'Get full details of a specific vessel. Use when the user asks "Show me KB-26" or "What is the status of Arcadia Zarah?"',
    paramsSchema: z.object({
      assetName: NonEmptyString.describe('Exact or partial vessel name'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { assetName: 'Arcadia Zarah' }, result: 'Full vessel details including location, specs, certifications' },
    ],
  },

  getAssetDocuments: {
    name: 'getAssetDocuments',
    description: 'List available documents for a vessel.',
    paramsSchema: z.object({
      assetName: NonEmptyString.describe('Vessel name'),
      docType: z.enum(['GA_PLAN', 'REGISTRY', 'INSURANCE', 'STABILITY_BOOKLET', 'SURVEY_CLASS']).optional(),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { assetName: 'KB 24', docType: 'REGISTRY' }, result: 'Registry certificate available for KB 24' },
    ],
  },

  sendAssetDocument: {
    name: 'sendAssetDocument',
    description: 'Send a document (such as GA Plan, Registry, Insurance, Stability Booklet, or Survey Certificate/Class) for a vessel directly to the user via WhatsApp. Use this when the user asks for a document, PDF, or certificate of a vessel.',
    paramsSchema: z.object({
      assetName: NonEmptyString.describe('Vessel name'),
      docType: z.enum(['GA_PLAN', 'REGISTRY', 'INSURANCE', 'STABILITY_BOOKLET', 'SURVEY_CLASS']).describe('Document type'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: false,
    examples: [
      { params: { assetName: 'Arcadia Zarah', docType: 'REGISTRY' }, result: 'Document sent via WhatsApp' },
      { params: { assetName: 'KB 26', docType: 'GA_PLAN' }, result: 'Document sent via WhatsApp' },
      { params: { assetName: 'KB 25', docType: 'STABILITY_BOOKLET' }, result: 'Document sent via WhatsApp' },
    ],
  },

  createTask: {
    name: 'createTask',
    description: 'Create a new assigned task for someone. Use when the user says "Tell X to do Y" or "Assign X to do Y".',
    paramsSchema: z.object({
      title: NonEmptyString.describe('Clear task description'),
      assigneeName: NonEmptyString.describe('Name of the person to assign the task to'),
      dueDate: DateSchema.describe('Due date in YYYY-MM-DD or YYYY-MM-DDTHH:MM format. Default to tomorrow if not specified.'),
      priority: PrioritySchema,
      description: z.string().optional().describe('Additional details about the task'),
      assetName: z.string().optional().describe('Related vessel/asset name if mentioned'),
    }),
    permissionCheck: isManagement,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { title: 'Inspect KB-26', assigneeName: 'Dhaval', dueDate: '2026-06-24', priority: 'MEDIUM' }, result: 'Task created and assigned to Dhaval Joisar' },
    ],
  },

  getUserTasks: {
    name: 'getUserTasks',
    description: 'Get tasks for a user. Use when the user asks "What are my tasks?" or "Show Dhaval\'s tasks"',
    paramsSchema: z.object({
      userName: z.string().optional().describe('User name. If omitted, returns the current user\'s tasks.'),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE']).optional(),
      overdue: z.boolean().optional().describe('If true, returns only overdue tasks'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { userName: 'Dhaval', status: 'PENDING' }, result: 'List of pending tasks for Dhaval' },
    ],
  },

  completeTask: {
    name: 'completeTask',
    description: 'Mark a task as completed. Use when the user says "Done", "I have completed it", "Finished"',
    paramsSchema: z.object({
      taskId: z.string().optional().describe('Task ID if known. Can be omitted if context provides it.'),
      titleContains: z.string().optional().describe('Partial task title if taskId is not known'),
      notes: z.string().optional().describe('Completion notes'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123', notes: 'Inspection completed successfully' }, result: 'Task marked as completed' },
    ],
  },

  requestTaskDelay: {
    name: 'requestTaskDelay',
    description: 'Request a deadline extension for a task. Use when the user says "Delay this until Monday", "I need more time"',
    paramsSchema: z.object({
      taskId: z.string().optional().describe('Task ID if known'),
      titleContains: z.string().optional().describe('Partial task title if taskId not known'),
      proposedDueDate: DateSchema.describe('New proposed deadline in YYYY-MM-DD or YYYY-MM-DDTHH:MM'),
      reason: NonEmptyString.describe('Reason for the delay'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123', proposedDueDate: '2026-06-30', reason: 'Surveyor unavailable' }, result: 'Delay request submitted for approval' },
    ],
  },

  approveTaskDelay: {
    name: 'approveTaskDelay',
    description: 'Approve or reject a pending delay request.',
    paramsSchema: z.object({
      delayRequestId: z.string().describe('The delay request ID'),
      approved: z.boolean().describe('True to approve, false to reject'),
      note: z.string().optional().describe('Optional note'),
    }),
    permissionCheck: isManagement,
    requiresConfirmation: true,
    idempotent: true,
    examples: [
      { params: { delayRequestId: 'dr456', approved: true, note: 'Approved, new surveyor available' }, result: 'Delay approved, task deadline updated' },
    ],
  },

  delegateTask: {
    name: 'delegateTask',
    description: 'Delegate a task to another user. Use when the user says "Delegate this to Hardik", "Transfer to Dhaval"',
    paramsSchema: z.object({
      taskId: z.string().optional().describe('Task ID if known'),
      titleContains: z.string().optional().describe('Partial task title if taskId not known'),
      assigneeName: NonEmptyString.describe('Name of the new assignee'),
      reason: z.string().optional().describe('Reason for delegation'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123', assigneeName: 'Hardik', reason: 'Better expertise' }, result: 'Task delegated to Hardik Kateshiya' },
    ],
  },

  cancelTask: {
    name: 'cancelTask',
    description: 'Cancel (soft-delete) a task. Use when the user says "Cancel this task"',
    paramsSchema: z.object({
      taskId: z.string().optional().describe('Task ID'),
      titleContains: z.string().optional().describe('Partial task title'),
      reason: NonEmptyString.describe('Reason for cancellation'),
    }),
    permissionCheck: isManagement,
    requiresConfirmation: true,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123', reason: 'No longer needed' }, result: 'Task cancelled' },
    ],
  },

  createReminder: {
    name: 'createReminder',
    description: 'Create a personal reminder for the current user.',
    paramsSchema: z.object({
      title: NonEmptyString.describe('What to remember'),
      description: z.string().optional().describe('Additional details'),
      remindAt: NonEmptyString.describe('When to remind, in YYYY-MM-DDTHH:MM format'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { title: 'Check emails', remindAt: '2026-06-24T09:00' }, result: 'Personal reminder set' },
    ],
  },

  acknowledgeTask: {
    name: 'acknowledgeTask',
    description: 'Acknowledge receipt of a task. Use when the user says "OK, I got it" or confirms they received the task.',
    paramsSchema: z.object({
      taskId: z.string().optional().describe('Task ID'),
      titleContains: z.string().optional().describe('Partial task title'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123' }, result: 'Task acknowledged' },
    ],
  },

  getExpiringRegistries: {
    name: 'getExpiringRegistries',
    description: 'List certificates/registries expiring within N days.',
    paramsSchema: z.object({
      days: z.number().int().min(0).max(365).default(90).describe('Days within expiry to check'),
      certType: z.string().optional().describe('Certificate type filter, e.g. SURVEY_CLASS, INSURANCE, REGISTRY'),
      assetName: z.string().optional().describe('Filter by vessel name'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { days: 90, certType: 'INSURANCE' }, result: 'List of insurance certificates expiring in 90 days' },
    ],
  },

  updateRegistryExpiry: {
    name: 'updateRegistryExpiry',
    description: 'Update a certificate expiry date after renewal.',
    paramsSchema: z.object({
      certificateId: z.string().describe('Certificate ID'),
      newIssueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('New issue date YYYY-MM-DD'),
      newExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('New expiry date YYYY-MM-DD'),
      documentUrl: z.string().url().optional().describe('Updated document URL'),
      remarks: z.string().optional().describe('Optional remarks'),
    }),
    permissionCheck: isOwner,
    requiresConfirmation: true,
    idempotent: true,
    examples: [
      { params: { certificateId: 'cert789', newExpiryDate: '2027-09-30', remarks: 'Renewed with new surveyor' }, result: 'Certificate expiry updated' },
    ],
  },

  getCompanySummary: {
    name: 'getCompanySummary',
    description: 'Get a high-level operational summary of the company.',
    paramsSchema: z.object({
      period: z.enum(['TODAY', 'WEEK', 'MONTH']).default('TODAY').describe('Time period for summary'),
    }),
    permissionCheck: isManagement,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { period: 'TODAY' }, result: 'Summary of tasks, vessels, and compliance status' },
    ],
  },

  getComplianceSummary: {
    name: 'getComplianceSummary',
    description: 'Get compliance risk summary: expired and expiring certificates, overdue tasks.',
    paramsSchema: z.object({
      days: z.number().int().min(0).max(365).default(90).describe('Check expiry within this many days'),
    }),
    permissionCheck: isManagement,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { days: 90 }, result: 'Compliance risks: 3 expiring certificates, 2 overdue tasks' },
    ],
  },

  searchTasks: {
    name: 'searchTasks',
    description: 'Search tasks by title query, status, assignee name, or creator name.',
    paramsSchema: z.object({
      query: z.string().optional().describe('Task title search term'),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE']).optional(),
      assigneeName: z.string().optional().describe('Filter by assignee name'),
      creatorName: z.string().optional().describe('Filter by creator name'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { query: 'KB-26', status: 'PENDING' }, result: 'Search pending tasks for KB-26' }
    ]
  },

  addTaskComment: {
    name: 'addTaskComment',
    description: 'Add a progress update, note, or comment to a task.',
    paramsSchema: z.object({
      taskId: z.string().describe('Task ID'),
      content: NonEmptyString.describe('The comment or progress text'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: false,
    examples: [
      { params: { taskId: 'abc123', content: 'Inspection is 50% complete' }, result: 'Comment added to task' }
    ]
  },

  getTaskDetails: {
    name: 'getTaskDetails',
    description: 'Retrieve full details of a specific task including comments and delegation logs.',
    paramsSchema: z.object({
      taskId: z.string().describe('Task ID'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { taskId: 'abc123' }, result: 'Task details and comment list' }
    ]
  },

  searchDocuments: {
    name: 'searchDocuments',
    description: 'Search all company documents by filename, description, vessel name, or type.',
    paramsSchema: z.object({
      query: z.string().optional().describe('Search query for filename or description'),
      vesselName: z.string().optional().describe('Filter by vessel name'),
      docType: z.enum(['GA_PLAN', 'REGISTRY', 'INSURANCE', 'STABILITY_BOOKLET', 'SURVEY_CLASS']).optional().describe('Filter by document type'),
    }),
    permissionCheck: allRoles,
    requiresConfirmation: false,
    idempotent: true,
    examples: [
      { params: { query: 'report', vesselName: 'KB-26' }, result: 'List of report documents for KB-26' }
    ]
  },
};

export function getToolDefinition(toolName: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS[toolName];
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_DEFINITIONS);
}

export function buildToolsPrompt(): string {
  const lines = getAllToolDefinitions().map((tool) => {
    let s = `\nTOOL: ${tool.name}\n`;
    s += `  Description: ${tool.description}\n`;
    s += `  Parameters:\n`;
    const shape = tool.paramsSchema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const desc = (value as any).description || '';
      const opt = tool.paramsSchema.isOptional() ? ' (optional)' : '';
      s += `    - ${key}: ${desc}${opt}\n`;
    }
    s += `  Examples:\n`;
    tool.examples.forEach((ex) => {
      s += `    ${JSON.stringify(ex.params)} => ${ex.result}\n`;
    });
    return s;
  });
  return lines.join('\n');
}
