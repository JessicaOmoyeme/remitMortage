import { Router } from "express";
import { analyzeRemittanceHistory } from "../services/stellar.js";
import { validateVerificationBody } from "../middleware/validate.js";

export const verificationRouter = Router();

/**
 * @openapi
 * /api/verification/check:
 *   post:
 *     summary: Analyze remittance payment history
 *     description: Accepts a Stellar sender wallet and recipient address, queries Horizon for outgoing USDC payments, and returns a remittance eligibility summary.
 *     tags:
 *       - Verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationCheckRequest'
 *           examples:
 *             check:
 *               value:
 *                 senderAddress: GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
 *                 recipientAddress: GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCJ
 *     responses:
 *       200:
 *         description: Remittance analysis completed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RemittanceAnalysis'
 *       400:
 *         description: Required request fields are missing.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Verification service failed unexpectedly.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
verificationRouter.post("/check", validateVerificationBody, async (req, res) => {
  try {
    const { senderAddress, recipientAddress } = req.body;

    // Validation middleware ensures inputs are present and valid

    const result = await analyzeRemittanceHistory(
      senderAddress,
      recipientAddress
    );

    res.json(result);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Verification service failed" });
  }
});
