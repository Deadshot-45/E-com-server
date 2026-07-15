import mongoose from "mongoose";

export const withTransaction = async <T>(
  callback: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> => {
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (err: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // Ignore abort errors
      }
      session.endSession();
    }

    // Check if it's a MongoDB transaction/session support error
    const isTransactionUnsupported =
      err.message?.includes("Transaction numbers are only allowed") ||
      err.message?.includes("does not support retryable writes") ||
      err.code === 20 ||
      err.codeName === "IllegalOperation";

    if (isTransactionUnsupported) {
      // Fallback: Run callback without transaction session
      return callback();
    }

    throw err;
  }
};
