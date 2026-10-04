/**
 * Shop policies shown at /policies/<slug> and linked in the footer.
 *
 * ── EDIT HERE ────────────────────────────────────────────────────────
 * These are the shop's promises. Change the numbers to what you actually
 * do — customers (and the law) hold you to what is written.
 * Bangladesh's Digital Commerce Operation Guidelines set upper limits on
 * delivery and refund times; keep these within them.
 */
export const PROMISES = {
  deliveryDhakaDays:   '1–3 working days',
  deliveryOutsideDays: '3–5 working days',
  returnWindowDays:    7,     // days after delivery to request a return
  refundDays:          7,     // working days to refund after the return is approved
  warrantyNote:        'Products with a manufacturer warranty are covered by that warranty. Keep the box, invoice and warranty card.',
  lastUpdated:         '5 October 2026',
};
// ─────────────────────────────────────────────────────────────────────

const taka = (n) => (n || n === 0 ? `৳${Number(n).toLocaleString('en-BD')}` : null);

/** Each policy: { title, summary, sections: [{ heading, body: [paragraph | [list items]] }] } */
export function buildPolicies(s = {}) {
  const shop    = s.site_name || 'Lata Electric';
  const phone   = s.phone && !/0{6}/.test(String(s.phone).replace(/\D/g, '')) ? s.phone : null;
  const contact = [phone && `phone ${phone}`, s.whatsapp && `WhatsApp ${s.whatsapp}`, s.email && `email ${s.email}`].filter(Boolean).join(', ') || 'the Contact page';
  const inside  = taka(s.shipping_inside);
  const outside = taka(s.shipping_outside);
  const free    = taka(s.free_delivery_threshold);
  const P = PROMISES;

  return {
    'returns': {
      title: 'Returns & Refunds',
      summary: `Changed your mind or received something wrong? You can return most items within ${P.returnWindowDays} days of delivery.`,
      sections: [
        { heading: 'What you can return', body: [
          `You can ask for a return within ${P.returnWindowDays} days of delivery if the item is:`,
          ['damaged or faulty when it arrived', 'not what you ordered (wrong model, size or colour)', 'unused, in its original box with all parts, if you simply changed your mind'],
        ] },
        { heading: 'What cannot be returned', body: [
          ['items that have been installed, wired, cut or used (for example cut cable, fitted switches or bulbs that have been used) — unless they are faulty',
           'items damaged by wrong installation, power surges or misuse',
           'items without their original box, accessories or invoice'],
        ] },
        { heading: 'How to return', body: [
          `Contact us (${contact}) with your order ID and a photo of the item. You can also tap “Request Return” on a delivered order in My Account.`,
          'We will confirm the return and arrange pickup, or ask you to bring it to our shop.',
          'Faulty or wrong items: we pay the return delivery. Change of mind: the customer pays the return delivery.',
        ] },
        { heading: 'Refunds', body: [
          `Once we receive and check the item, we approve the return and refund you within ${P.refundDays} working days — to the same bKash/Nagad number you paid from, or by bKash/bank transfer for cash-on-delivery orders.`,
          'Delivery charges are refunded only when the item was faulty or wrong. You can also choose a replacement or store credit instead of a refund.',
        ] },
        { heading: 'Warranty', body: [P.warrantyNote] },
      ],
    },

    'delivery': {
      title: 'Delivery Information',
      summary: `We deliver across Bangladesh. Inside Dhaka: ${P.deliveryDhakaDays}. Outside Dhaka: ${P.deliveryOutsideDays}.`,
      sections: [
        { heading: 'Delivery time', body: [
          ['Inside Dhaka (and Gazipur, Narayanganj, Narsingdi, Manikganj, Munshiganj): ' + P.deliveryDhakaDays,
           'Outside Dhaka: ' + P.deliveryOutsideDays],
          'Times start when we confirm your order by phone. Fridays and public holidays are not working days.',
        ] },
        { heading: 'Delivery charge', body: [
          [inside ? `Inside Dhaka area: ${inside}` : 'Inside Dhaka area: shown at checkout',
           outside ? `Outside Dhaka: ${outside}` : 'Outside Dhaka: shown at checkout',
           ...(free ? [`Free delivery on orders of ${free} or more`] : [])],
          'The exact charge is always shown at checkout before you place the order.',
        ] },
        { heading: 'Payment', body: [
          'Cash on delivery is available everywhere we deliver. You can also pay in advance by bKash or Nagad at checkout.',
          'Please check the item in front of the delivery person before paying. If something is wrong, you may refuse it.',
        ] },
        { heading: 'Order tracking', body: [
          'After ordering you get an order ID. Track it any time on the “Track Order” page with that ID and your phone number, or in My Account if you are signed in.',
        ] },
        { heading: 'Large items and installation', body: [
          'Some heavy items (for example ceiling fans in bulk, cable coils) may need extra time or a different courier; we will call you first. Installation is not included unless stated — ask about our electricians.',
        ] },
      ],
    },

    'privacy': {
      title: 'Privacy Policy',
      summary: 'What we collect, why, and how we keep it safe. We never sell your information.',
      sections: [
        { heading: 'What we collect', body: [
          ['Order details: name, phone number, delivery address, email (optional) and the items you buy',
           'Account details if you create one: email, name, and the profile/address you save. If you sign in with Google we receive your name, email and profile photo',
           'Payment references such as a bKash/Nagad transaction ID. We never see or store card numbers or PINs',
           'Basic technical data needed to run the site, such as your cart saved in your browser'],
        ] },
        { heading: 'Why we use it', body: [
          ['to deliver your order and contact you about it', 'to show your order history and fill in checkout for you', 'to handle returns, refunds and warranty', 'to keep the shop secure and prevent fraud'],
          'We do not send marketing messages unless you agree to them.',
        ] },
        { heading: 'Who we share it with', body: [
          'Only with the courier delivering your order (name, phone, address) and with services that run the shop for us (hosting and database). We never sell or rent your information.',
        ] },
        { heading: 'How long we keep it', body: [
          'Order records are kept as long as needed for accounting, warranty and legal reasons. You can ask us to delete your account at any time.',
        ] },
        { heading: 'Your choices', body: [
          `You can see and edit your profile in My Account, and ask us to correct or delete your information by contacting us (${contact}).`,
        ] },
      ],
    },

    'terms': {
      title: 'Terms & Conditions',
      summary: `The rules for buying from ${shop}. By placing an order you agree to them.`,
      sections: [
        { heading: 'Orders', body: [
          'An order is confirmed when we call or message you to confirm it. We may cancel an order if an item is out of stock, the price was shown wrongly, or we cannot reach you; any advance payment is then refunded in full.',
        ] },
        { heading: 'Prices', body: [
          'Prices are in Bangladeshi Taka (৳) and include VAT where applicable. Delivery charges are shown separately at checkout. Prices and offers may change, but never after your order is confirmed.',
        ] },
        { heading: 'Product information', body: [
          'We try to show every product accurately. Colours in photos may look slightly different on screens, and the manufacturer may change packaging. Specifications come from the manufacturer.',
        ] },
        { heading: 'Safety', body: [
          'Electrical products should be installed by a qualified electrician. We are not responsible for damage caused by wrong installation or misuse.',
        ] },
        { heading: 'Returns, refunds and delivery', body: [
          'These are explained on our Returns & Refunds and Delivery Information pages, which are part of these terms.',
        ] },
        { heading: 'Accounts', body: [
          'Keep your password private. You are responsible for orders placed from your account. We may close accounts that are used for fraud.',
        ] },
        { heading: 'Contact', body: [
          `${shop}${s.address ? `, ${s.address}` : ''}. Contact: ${contact}.`,
        ] },
      ],
    },
  };
}

export const POLICY_LINKS = [
  ['returns',  'Returns & Refunds'],
  ['delivery', 'Delivery Information'],
  ['privacy',  'Privacy Policy'],
  ['terms',    'Terms & Conditions'],
];
