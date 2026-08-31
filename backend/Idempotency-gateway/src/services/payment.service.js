const database = require("../config/database");
const idempotencyRepository = require("../repositories/idempotency.repository");
const paymentRepository = require("../repositories/payment.repository");
const { environment } = require("../config/environment");

function displayAmount(amount) {
  return Number(amount).toString();
}

function createPaymentService({
  databaseClient = database,
  idempotencyRepo = idempotencyRepository,
  paymentRepo = paymentRepository,
  processingDelayMs = environment.processingDelayMs
} = {}) {
  return {
    async process(record) {
      await new Promise((resolve) => setTimeout(resolve, processingDelayMs));

      const responseStatus = 201;
      const responseBody = {
        status: `Charged ${displayAmount(record.amount)} ${record.currency}`
      };

      await databaseClient.transaction(async (client) => {
        await paymentRepo.createPayment(
          {
            idempotencyRecordId: record.id,
            amount: record.amount,
            currency: record.currency
          },
          client
        );
        await idempotencyRepo.markCompleted(
          record.id,
          responseStatus,
          responseBody,
          client
        );
      });

      return { statusCode: responseStatus, body: responseBody };
    }
  };
}

module.exports = {
  createPaymentService,
  paymentService: createPaymentService()
};
