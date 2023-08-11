import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

import { isDemoMode } from "src/utils/demo-helpers";
import { createAccountOnboardingUrl } from "src/utils/onboarding-helpers";
import { getSessionForServerSide } from "src/utils/session-helpers";
import stripe from "src/utils/stripe-loader";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(400).json({ error: "Bad Request" });
  }

  const session = await getSessionForServerSide(req, res);
  const email = session.email;
  const accountId = session.accountId;

  if (isDemoMode()) {
    const skipOnboarding = req.body.skipOnboarding === true;

    const tosAcceptance = { date: 1691518261, ip: "127.0.0.1" };
    // TODO: Only update the fields during the demo that are outstanding to speed things up
    const fakeOnboardingData: Stripe.AccountUpdateParams = {
      business_profile: {
        // Merchant category code for "computer software stores" (https://fs.fldfs.com/iwpapps/pcard/docs/MCCs.pdf)
        mcc: "5734",
        product_description: "Some demo product",
        url: "https://some-company.com",
      },
      individual: {
        address: {
          // This value causes the address to be verified in testmode: https://stripe.com/docs/connect/testing#test-verification-addresses
          line1: "address_full_match",
          city: "South San Francisco",
          state: "CA",
          postal_code: "94080",
          country: "US",
        },
        // These values together cause the DOB to be verified in testmode: https://stripe.com/docs/connect/testing#test-dobs
        dob: {
          day: 1,
          month: 1,
          year: 1901,
        },
        email: email,
        first_name: "John",
        last_name: "Smith",
        // Fake phone number: https://stripe.com/docs/connect/testing
        phone: "0000000000",
      },
      // Faking Terms of Service acceptances
      settings: {
        card_issuing: {
          tos_acceptance: tosAcceptance,
        },
        treasury: {
          tos_acceptance: tosAcceptance,
        },
      },
      ...(skipOnboarding && { tos_acceptance: tosAcceptance }),
    };

    // FOR-DEMO-ONLY: We're using fake data for illustrative purposes in this demo. The fake data will be used to bypass
    // showing the Stripe Connect Onboarding forms. In a real application, you would not do this so that you can collect
    // the real KYC data from your users.
    await stripe.accounts.update(accountId, fakeOnboardingData);

    if (skipOnboarding) {
      return res.status(200).json({ accountId });
    }
  }

  // This is the Connect Onboarding URL that will be used to collect KYC information from the user
  const onboardingUrl = await createAccountOnboardingUrl(accountId);

  return res.status(200).json({ accountId, redirectUrl: onboardingUrl });
};

export default handler;