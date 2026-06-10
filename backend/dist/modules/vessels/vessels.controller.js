"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExportSnapshot = exports.getLocationHistory = exports.updateVesselLocation = exports.createVessel = exports.getVesselDetails = exports.getVessels = void 0;
const vessels_service_1 = require("./vessels.service");
const getVessels = async (req, res, next) => {
    try {
        const vessels = await vessels_service_1.VesselsService.getVessels(req.query);
        return res.status(200).json({
            status: 'success',
            data: { vessels },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVessels = getVessels;
const getVesselDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vessel = await vessels_service_1.VesselsService.getVesselById(id);
        return res.status(200).json({
            status: 'success',
            data: { vessel },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVesselDetails = getVesselDetails;
const createVessel = async (req, res, next) => {
    try {
        const vessel = await vessels_service_1.VesselsService.createVessel(req.body, req.user.id);
        return res.status(201).json({
            status: 'success',
            data: { vessel },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createVessel = createVessel;
const updateVesselLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await vessels_service_1.VesselsService.updateVesselLocation(id, req.body, req.user);
        return res.status(200).json({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVesselLocation = updateVesselLocation;
const getLocationHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page, limit } = req.query;
        const result = await vessels_service_1.VesselsService.getLocationHistory(id, page, limit);
        return res.status(200).json({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLocationHistory = getLocationHistory;
const getExportSnapshot = async (req, res, next) => {
    try {
        const snapshot = await vessels_service_1.VesselsService.getExportSnapshot();
        return res.status(200).json({
            status: 'success',
            data: snapshot,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getExportSnapshot = getExportSnapshot;
