import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient();

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
          const data = args.data as any;
          if (Array.isArray(data)) {
            args.data = data.map((item: any) => ({ deletedAt: null, ...item })) as any;
          } else {
            args.data = { deletedAt: null, ...data } as any;
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

export default prisma;
