// tracking.controller.js

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Order } from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import axios from "axios";

// Delhivery se live tracking status fetch karega
const getDelhiveryTrackingStatus = async (trackingNumber) => {
  try {
    // Delhivery ka tracking URL (waybill = tracking number)
    const response = await axios.get(
      `${process.env.DELHIVERY_API_URL}/api/v1/packages/json/?waybill=${trackingNumber}`,
      {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const { ShipmentData } = response.data;
    if (ShipmentData && ShipmentData.length > 0) {
      // Sabse latest status lein
      const latestStatus = ShipmentData[0].Status;
      return {
        status: latestStatus.Status, // e.g., "In Transit", "Dispatched"
        location: latestStatus.ScannedLocation,
        timestamp: latestStatus.StatusDateTime,
      };
    }
    return { status: "Awaiting Update", location: "N/A" };
  } catch (error) {
    console.error("Delhivery Tracking API Error:", error.message);
    throw new Error("Failed to fetch tracking status.");
  }
};

export const trackOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  if (
    req.user.role !== "admin" &&
    order.user.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Not authorized to track this order.");
  }

  const trackingNumber = order.shipmentDetails?.trackingNumber;
  if (!trackingNumber)
    throw new ApiError(400, "Order has not been shipped yet.");

  const liveStatus = await getDelhiveryTrackingStatus(trackingNumber);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        orderStatus: order.orderStatus, // DB status
        liveCourierStatus: liveStatus, // Delhivery se live status
      },
      "Tracking status fetched."
    )
  );
});
