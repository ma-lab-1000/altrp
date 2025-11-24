import type { BotFlow } from '../../core/flow-types';

export const onboardingFlow: BotFlow = {
  name: 'onboarding',
  description: 'Matcher onboarding flow for offers and requests',
  steps: [
    {
      type: 'message',
      id: 'send_welcome',
      text: '👋 <b>Matcher</b> поможет найти товары или услуги внутри сообщества.\nНажмите кнопку, чтобы пройти короткий онбординг.',
      keyboardKey: 'start_onboarding_button'
    },
    {
      type: 'wait_input',
      id: 'onboarding_asking_name',
      text: 'Как вас зовут?',
      saveToVariable: 'onboarding.name',
      nextStepId: 'onboarding_asking_email'
    },
    {
      type: 'wait_input',
      id: 'onboarding_asking_email',
      text: 'Укажите email для связи:',
      saveToVariable: 'onboarding.email',
      validation: {
        type: 'email',
        errorMessage: 'Пожалуйста, укажите корректный email'
      },
      nextStepId: 'onboarding_choose_role'
    },
    {
      type: 'message',
      id: 'onboarding_choose_role',
      text: 'В какой роли вы регистрируетесь?',
      keyboardKey: 'matcher_role_keyboard'
    },
    {
      type: 'condition',
      id: 'onboarding_role_condition',
      condition: "globalObject.onboarding.role === 'offer'",
      trueStep: 'onboarding_select_offer_type',
      falseStep: 'onboarding_select_search_type'
    },
    {
      type: 'message',
      id: 'onboarding_select_offer_type',
      text: 'Что вы предлагаете?',
      keyboardKey: 'matcher_offer_type_keyboard'
    },
    {
      type: 'message',
      id: 'onboarding_select_search_type',
      text: 'Что вы ищете?',
      keyboardKey: 'matcher_search_type_keyboard'
    },
    {
      type: 'handler',
      id: 'onboarding_assign_topic',
      handlerName: 'matcherAssignTopicHandler',
      nextStepId: 'onboarding_mode_condition'
    },
    {
      type: 'condition',
      id: 'onboarding_mode_condition',
      condition: "globalObject.onboarding.role === 'offer'",
      trueStep: 'onboarding_offer_title',
      falseStep: 'onboarding_search_description'
    },
    {
      type: 'wait_input',
      id: 'onboarding_offer_title',
      text: 'Как называется ваш товар или услуга?',
      saveToVariable: 'onboarding.offer.title',
      nextStepId: 'onboarding_offer_description'
    },
    {
      type: 'wait_input',
      id: 'onboarding_offer_description',
      text: 'Опишите предложение подробнее:',
      saveToVariable: 'onboarding.offer.description',
      nextStepId: 'onboarding_offer_price'
    },
    {
      type: 'wait_input',
      id: 'onboarding_offer_price',
      text: 'Укажите стоимость (например, 1500):',
      saveToVariable: 'onboarding.offer.price',
      validation: {
        type: 'number',
        errorMessage: 'Цена должна быть числом'
      },
      nextStepId: 'onboarding_save_offer'
    },
    {
      type: 'handler',
      id: 'onboarding_save_offer',
      handlerName: 'matcherSaveOfferHandler',
      nextStepId: 'onboarding_offer_thanks'
    },
    {
      type: 'message',
      id: 'onboarding_offer_thanks',
      text: '✅ Ваше предложение сохранено и отправлено в профильную группу.',
      nextStepId: 'onboarding_finish_menu'
    },
    {
      type: 'wait_input',
      id: 'onboarding_search_description',
      text: 'Опишите, что именно вы ищете:',
      saveToVariable: 'onboarding.search.description',
      nextStepId: 'onboarding_save_search'
    },
    {
      type: 'handler',
      id: 'onboarding_save_search',
      handlerName: 'matcherSaveSearchHandler',
      nextStepId: 'onboarding_search_thanks'
    },
    {
      type: 'message',
      id: 'onboarding_search_thanks',
      text: '🔎 Ваш запрос отправлен участникам соответствующей группы.',
      nextStepId: 'onboarding_finish_menu'
    },
    {
      type: 'flow',
      id: 'onboarding_finish_menu',
      flowName: 'menu'
    }
  ]
};
