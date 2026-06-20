"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const basePrisma = new client_1.PrismaClient();
const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async create({ model, args, query }) {
                if (model === 'Vessel' || model === 'Task') {
                    args.data = { deletedAt: null, ...args.data };
                }
                return query(args);
            },
            async createMany({ model, args, query }) {
                if (model === 'Vessel' || model === 'Task') {
                    const data = args.data;
                    if (Array.isArray(data)) {
                        args.data = data.map((item) => ({ deletedAt: null, ...item }));
                    }
                    else {
                        args.data = { deletedAt: null, ...data };
                    }
                }
                return query(args);
            },
            async findMany({ model, args, query }) {
                if ((model === 'Vessel' || model === 'Task') && args.where && args.where.deletedAt === null) {
                    const { deletedAt, ...restWhere } = args.where;
                    args.where = {
                        ...restWhere,
                        OR: [
                            { deletedAt: null },
                            { deletedAt: { isSet: false } }
                        ]
                    };
                }
                return query(args);
            },
            async findFirst({ model, args, query }) {
                if ((model === 'Vessel' || model === 'Task') && args.where && args.where.deletedAt === null) {
                    const { deletedAt, ...restWhere } = args.where;
                    args.where = {
                        ...restWhere,
                        OR: [
                            { deletedAt: null },
                            { deletedAt: { isSet: false } }
                        ]
                    };
                }
                return query(args);
            },
            async update({ model, args, query }) {
                if ((model === 'Vessel' || model === 'Task') && args.where && args.where.deletedAt === null) {
                    const { deletedAt, ...restWhere } = args.where;
                    args.where = {
                        ...restWhere,
                        OR: [
                            { deletedAt: null },
                            { deletedAt: { isSet: false } }
                        ]
                    };
                }
                return query(args);
            },
            async updateMany({ model, args, query }) {
                if ((model === 'Vessel' || model === 'Task') && args.where && args.where.deletedAt === null) {
                    const { deletedAt, ...restWhere } = args.where;
                    args.where = {
                        ...restWhere,
                        OR: [
                            { deletedAt: null },
                            { deletedAt: { isSet: false } }
                        ]
                    };
                }
                return query(args);
            },
            async count({ model, args, query }) {
                if ((model === 'Vessel' || model === 'Task') && args?.where && args.where.deletedAt === null) {
                    const { deletedAt, ...restWhere } = args.where;
                    args.where = {
                        ...restWhere,
                        OR: [
                            { deletedAt: null },
                            { deletedAt: { isSet: false } }
                        ]
                    };
                }
                return query(args);
            }
        }
    }
});
exports.default = prisma;
