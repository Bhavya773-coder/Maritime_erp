"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../../middleware/auth");
const validator_1 = require("../../middleware/validator");
const vessels_controller_1 = require("./vessels.controller");
const vessels_schema_1 = require("./vessels.schema");
const router = (0, express_1.Router)();
// Middleware to validate UUID vessel ID params
const validateVesselId = (req, res, next) => {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (id && !uuidRegex.test(id)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid vessel id',
        });
    }
    next();
};
// Require authentication for all vessel routes
router.use(auth_1.requireAuth);
// Export-ready snapshot MUST be registered before /:id to avoid route collision
router.get('/export/snapshot', vessels_controller_1.getExportSnapshot);
// Standard vessel operations
router.get('/', (0, validator_1.validate)(vessels_schema_1.getVesselsQuerySchema), vessels_controller_1.getVessels);
router.post('/', (0, auth_1.requireRole)([client_1.Role.OWNER]), (0, validator_1.validate)(vessels_schema_1.createVesselSchema), vessels_controller_1.createVessel);
router.get('/:id', validateVesselId, vessels_controller_1.getVesselDetails);
router.patch('/:id/location', validateVesselId, (0, auth_1.requireRole)([client_1.Role.OWNER, client_1.Role.FLEET_MANAGER]), (0, validator_1.validate)(vessels_schema_1.updateLocationSchema), vessels_controller_1.updateVesselLocation);
router.get('/:id/history', validateVesselId, (0, validator_1.validate)(vessels_schema_1.getHistoryQuerySchema), vessels_controller_1.getLocationHistory);
exports.default = router;
