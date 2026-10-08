// Shared business rules (server is the source of truth for money math)
module.exports = {
  PLATFORM_FEE: 0.02,          // 2% escrow/transaction fee charged to buyer
  TRUCK_COMMISSION: 0.08,      // 8% of truck charge is platform commission (info only)
  AUTO_RELEASE_MINUTES: Number(process.env.AUTO_RELEASE_MINUTES) || 48 * 60, // buyer has 48h after shipping to dispute; else auto-release (set 2 for a live demo)
  // Approx. shelf life in days at normal storage — ESTIMATES for the freshness countdown, not lab values.
  SHELF_LIFE: { tomato: 7, onion: 60, potato: 60, wheat: 365, brinjal: 6, banana: 6, cabbage: 12, cauliflower: 7, spinach: 3, 'green chilli': 7, mango: 6, default: 14 },
  MODES: { pickup: 0, truck: 40, society: 15, hub: 10 } // delivery charge in Rs per quintal
};
