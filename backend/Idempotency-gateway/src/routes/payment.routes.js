const express = require("express");
const { createPaymentController } = require("../controllers/payment.controller");

function createPaymentRouter(service) {
  const router = express.Router();
  const controller = createPaymentController(service);

  router.post("/", controller.processPayment);
  return router;
}

module.exports = { createPaymentRouter };
