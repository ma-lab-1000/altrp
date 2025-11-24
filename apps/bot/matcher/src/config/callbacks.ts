export const keyboards = {
  start_onboarding_button: {
    inline_keyboard: [[
      {
        text: "🚀 Начать",
        callback_data: "start_onboarding_button"
      }
    ]]
  },
  matcher_role_keyboard: {
    inline_keyboard: [[
      {
        text: "Предлагаю",
        callback_data: "matcher_role_offer"
      },
      {
        text: "Ищу",
        callback_data: "matcher_role_search"
      }
    ]]
  },
  matcher_offer_type_keyboard: {
    inline_keyboard: [[
      {
        text: "Товар",
        callback_data: "matcher_select_product"
      },
      {
        text: "Услуга",
        callback_data: "matcher_select_service"
      }
    ]]
  },
  matcher_search_type_keyboard: {
    inline_keyboard: [[
      {
        text: "Товар",
        callback_data: "matcher_select_product"
      },
      {
        text: "Услуга",
        callback_data: "matcher_select_service"
      }
    ]]
  }
};

export const callbackActions = {
  start_onboarding_button: {
    action: "go_to_step",
    nextStepId: "onboarding_asking_name"
  },
  matcher_role_offer: {
    action: "set_variable",
    variable: "onboarding.role",
    value: "offer",
    nextStepId: "onboarding_role_condition"
  },
  matcher_role_search: {
    action: "set_variable",
    variable: "onboarding.role",
    value: "search",
    nextStepId: "onboarding_role_condition"
  },
  matcher_select_product: {
    action: "set_variable",
    variable: "onboarding.itemType",
    value: "product",
    nextStepId: "onboarding_assign_topic"
  },
  matcher_select_service: {
    action: "set_variable",
    variable: "onboarding.itemType",
    value: "service",
    nextStepId: "onboarding_assign_topic"
  }
} as const;


// Legacy callbacks removed - now only callbackActions is used

// TypeScript types
//export type CommandHandler = keyof typeof commands;
export type CallbackActionType = 'start_flow' | 'go_to_step' | 'go_to_flow' | 'set_variable' | 'handler';

export interface CallbackActionConfig {
  action: CallbackActionType;
  flowName?: string;    // For start_flow
  nextStepId?: string;      // For go_to_step
  variable?: string;    // For set_variable
  value?: any;          // For set_variable
  nextFlow?: string;    // For transition to next flow after action
  handlerName?: string; // For handler action - name of custom handler
}
