/**
 * src/utils/whatsapp.js
 *
 * WHY THIS FILE EXISTS:
 * Sending a WhatsApp OTP via Meta's Cloud API involves making an HTTP POST
 * request to the Graph API endpoint. This utility encapsulates that HTTP call
 * so that the Auth controller doesn't need to know the API structure of Meta's
 * endpoint — it just calls sendWhatsAppOtp(phone, otp) and that's it.
 *
 * WHY META CLOUD API (not Twilio or others):
 * The app owner has verified WhatsApp Business access, meaning they can
 * use Meta's first-party infrastructure directly without a third-party relay.
 * This is cheaper at scale and gives direct access to delivery receipts,
 * template management, and business account controls in Meta's dashboard.
 *
 * HOW META CLOUD API WORKS:
 * 1. You must have an approved OTP message template in your WhatsApp Manager.
 *    Meta provides a default "authentication" category template named "otp".
 * 2. You call: POST https://graph.facebook.com/{version}/{phone_number_id}/messages
 * 3. The request body specifies:
 *    - The recipient's phone number (in E.164 format: +91XXXXXXXXXX)
 *    - The template name and language
 *    - The template parameters (the OTP code itself fills in the {{1}} variable)
 * 4. Meta sends the WhatsApp message on your behalf.
 *
 * PHONE NUMBER FORMAT:
 * Meta's API requires phone numbers WITHOUT the + sign in the "to" field.
 * We strip it if present. Example: "+919876543210" → "919876543210"
 *
 * AUTHENTICATION TEMPLATE FORMAT:
 * Meta's standard OTP authentication template sends a message like:
 *   "Your NestRoom verification code is: 473821
 *    This code expires in 5 minutes. Do not share this code."
 * The OTP replaces the {{1}} component in the template.
 */

const axios = require('axios');

/**
 * Sends a WhatsApp OTP message using Meta's Cloud API.
 *
 * @param {string} phone - Recipient's phone number (E.164: "+919876543210" or "919876543210")
 * @param {string} otp - The 6-digit OTP string to send
 * @returns {Promise<void>} Resolves on success, throws on API error
 */
async function sendWhatsAppOtp(phone, otp) {
  const version = process.env.META_WHATSAPP_API_VERSION || 'v21.0';
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_TOKEN;
  const templateName = process.env.META_OTP_TEMPLATE_NAME || 'otp';
  const languageCode = process.env.META_TEMPLATE_LANGUAGE_CODE || 'en';

  // Strip leading + for Meta's API format
  const recipientPhone = phone.replace(/^\+/, '');

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          // The 'body' component contains the OTP variable {{1}}
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: otp,
            },
          ],
        },
        {
          // The 'button' component (copy_code button) also receives the OTP
          // so the user can tap "Copy Code" in WhatsApp to auto-fill it.
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: otp,
            },
          ],
        },
      ],
    },
  };

  await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

module.exports = { sendWhatsAppOtp };
