import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { analyzeRemittanceHistory } from "../services/stellar.js";
import { calculateCreditScore } from "../services/scoring.js";
import { validateVerificationBody, validateWalletAddress, validateMultiChainOwnership } from "../middleware/validate.js";
import { createChallenge, consumeChallenge } from "../services/challengeStore.js";
import { verifyEvmSignature } from "../services/evm.js";
import { verifySolanaSignature } from "../services/solana.js";

export const verificationRouter = Router();

/**
 * @openapi
 * /api/verification/check:
 *   post:
 *     summary: Analyze remittance payment history
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationCheckRequest'
 *     responses:
 *       200:
 *         description: Remittance analysis completed.
 *       400:
 *         description: Required request fields are missing.
 *       500:
 *         description: Verification service failed unexpectedly.
 */
verificationRouter.post("/check", validateVerificationBody, async (req, res) => {
  try {
    const { senderAddress, recipientAddress } = req.body;
    const result = await analyzeRemittanceHistory(senderAddress, recipientAddress);
    res.json(result);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Verification service failed" });
  }
});

/**
 * @openapi
 * /api/verification/score:
 *   post:
 *     summary: Calculate borrower credit score
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationCheckRequest'
 *     responses:
 *       200:
 *         description: Scoring completed successfully.
 *       400:
 *         description: Missing fields.
 *       500:
 *         description: Scoring service failed.
 */
verificationRouter.post("/score", validateVerificationBody, async (req, res) => {
  try {
    const { senderAddress, recipientAddress } = req.body;
    const analysisResult = await analyzeRemittanceHistory(senderAddress, recipientAddress);
    const scoreResult = calculateCreditScore(analysisResult);
    res.json(scoreResult);
  } catch (error) {
    console.error("Scoring error:", error);
    res.status(500).json({ error: "Scoring service failed" });
  }
});

/**
 * @openapi
 * /api/verification/challenge:
 *   post:
 *     summary: Issue a wallet-ownership challenge
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, network]
 *             properties:
 *               walletAddress:
 *                 type: string
 *               network:
 *                 type: string
 *                 enum: [stellar, ethereum, solana]
 *     responses:
 *       200:
 *         description: Challenge string to sign.
 *       400:
 *         description: Invalid or missing walletAddress / network.
 */
verificationRouter.post("/challenge", validateMultiChainOwnership, (req, res) => {
  const { walletAddress } = req.body;
  const challenge = createChallenge(walletAddress);
  res.json({ challenge });
});

/**
 * @openapi
 * /api/verification/verify-ownership:
 *   post:
 *     summary: Verify a signed wallet-ownership challenge
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, network, challenge, signature]
 *             properties:
 *               walletAddress:
 *                 type: string
 *               network:
 *                 type: string
 *                 enum: [stellar, ethereum, solana]
 *               challenge:
 *                 type: string
 *               signature:
 *                 type: string
 *                 description: Hex-encoded signature of the challenge.
 *     responses:
 *       200:
 *         description: Ownership verified.
 *       400:
 *         description: Missing required fields.
 *       401:
 *         description: Invalid signature.
 *       410:
 *         description: Challenge expired or already used.
 */
verificationRouter.post("/verify-ownership", validateMultiChainOwnership, (req, res) => {
  const { walletAddress, network, challenge, signature } = req.body;

  if (!challenge || !signature) {
    res.status(400).json({ error: "missing_field", message: "challenge and signature are required" });
    return;
  }

  const result = consumeChallenge(walletAddress, challenge);
  if (!result.ok) {
    res.status(410).json({ error: "challenge_invalid", reason: result.reason });
    return;
  }

  let valid = false;
  try {
    if (network === "stellar") {
      const keypair = Keypair.fromPublicKey(walletAddress);
      const messageBytes = Buffer.from(challenge, "utf8");
      const sigBytes = Buffer.from(signature, "hex");
      valid = keypair.verify(messageBytes, sigBytes);
    } else if (network === "ethereum") {
      valid = verifyEvmSignature(walletAddress, challenge, signature);
    } else if (network === "solana") {
      valid = verifySolanaSignature(walletAddress, challenge, signature);
    }
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  res.json({ verified: true, walletAddress, network });
});
