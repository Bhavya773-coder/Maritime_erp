"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const users_controller_1 = require("./users.controller");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.get('/active', auth_1.requireAuth, (0, auth_1.requireRole)([client_1.Role.OWNER, client_1.Role.MANAGER]), users_controller_1.getActiveUsers);
exports.default = router;
