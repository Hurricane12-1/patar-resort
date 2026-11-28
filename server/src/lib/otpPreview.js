// The OTP code is sent back to the browser only on a local development machine that sets SHOW_OTP_PREVIEW=true.
// On the live server the code must arrive only by email, otherwise anyone could read it from the response.
export function devOtpPreview(code) {
  return process.env.SHOW_OTP_PREVIEW === 'true' ? { otp_preview: code } : {};
}
