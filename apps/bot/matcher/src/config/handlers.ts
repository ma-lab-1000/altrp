import { BotInterface } from '../core/bot-interface';
import { UserContextManager } from '../core/user-context';
import { ProductRepository } from '../repositories/ProductRepository';
import type { MessageThreadData } from '../repositories/MessageThreadRepository';

type Role = 'offer' | 'search';
type ItemType = 'product' | 'service';
type CombinationKey = `${Role}_${ItemType}`;

const ROLE_LABELS: Record<Role, string> = {
  offer: 'Предлагаю',
  search: 'Ищу'
};

const ITEM_LABELS: Record<ItemType, string> = {
  product: 'товар',
  service: 'услугу'
};

const GROUP_TITLES: Record<CombinationKey, string> = {
  offer_service: 'Предлагаю услугу',
  offer_product: 'Предлагаю товар',
  search_service: 'Ищу услугу',
  search_product: 'Ищу товар'
};

export const createCustomHandlers = (worker: BotInterface) => {
  const handlerWorker = {
    d1Storage: worker['d1Storage'],
    humanRepository: worker['humanRepository'],
    messageRepository: worker['messageRepository'],
    messageThreadRepository: worker['messageThreadRepository'],
    flowEngine: worker['flowEngine'],
    env: worker['env'],
    messageService: worker['messageService'],
    topicService: worker['topicService']
  };

  const productRepository = handlerWorker.env?.DB
    ? new ProductRepository({ db: handlerWorker.env.DB })
    : null;

  const groupCache: Partial<Record<CombinationKey, MessageThreadData>> = {};
  let groupsLoaded = false;

  const ensureGroupsLoaded = async () => {
    if (groupsLoaded) return;
    const groups = await handlerWorker.messageThreadRepository.getParentThreadsByType('matcher');
    groups.forEach(group => {
      const entry = Object.entries(GROUP_TITLES).find(([, title]) => title === group.title);
      if (entry) {
        groupCache[entry[0] as CombinationKey] = group;
      }
    });
    groupsLoaded = true;
  };

  const getGroupByCombination = async (combination: CombinationKey) => {
    await ensureGroupsLoaded();
    const group = groupCache[combination];
    if (!group) {
      throw new Error(`Group "${combination}" not configured in message_threads`);
    }
    if (!group.value) {
      throw new Error(`Group "${combination}" does not have chat_id in value`);
    }
    return group;
  };

  const parseHumanDataIn = (human: any) => {
    if (!human?.dataIn) {
      return {};
    }
    try {
      return JSON.parse(human.dataIn);
    } catch (error) {
      console.warn('Failed to parse human data_in, fallback to empty object', error);
      return {};
    }
  };

  const saveHumanDataIn = async (telegramId: number, data: any) => {
    await handlerWorker.humanRepository.updateHumanDataIn(telegramId, JSON.stringify(data));
  };

  const buildCombinationKey = (role?: Role, itemType?: ItemType): CombinationKey | null => {
    if (!role || !itemType) {
      return null;
    }
    return `${role}_${itemType}` as CombinationKey;
  };

  const buildTopicTitle = (fullName: string, combination: CombinationKey) => {
    const groupTitle = GROUP_TITLES[combination];
    return `${fullName} — ${groupTitle}`;
  };

  const parseNumber = (value?: string): number | null => {
    if (!value) return null;
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getTopicRouting = async (telegramId: number, contextManager: UserContextManager) => {
    const context = await contextManager.getContext(telegramId);
    const topicId = context?.data?.onboarding?.topicId;
    const chatId = context?.data?.onboarding?.chatId;
    return { topicId, chatId, context };
  };

  const notifyTopic = async (chatId: number, topicId: number, text: string) => {
    await handlerWorker.messageService.sendMessageToTopic(chatId, topicId, text);
  };

  const getOrCreateHuman = async (message: any) => {
    const telegramId = message.from.id;
    let human = await handlerWorker.humanRepository.getHumanByTelegramId(telegramId);
    if (human) {
      return human;
    }
    const fullName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.first_name || 'Unknown';
    const dataIn = {
      telegram_id: telegramId,
      first_name: message.from.first_name,
      last_name: message.from.last_name || '',
      username: message.from.username || ''
    };
    await handlerWorker.humanRepository.addHuman({
      fullName,
      dataIn: JSON.stringify(dataIn)
    });
    human = await handlerWorker.humanRepository.getHumanByTelegramId(telegramId);
    return human;
  };

  return {
    handleStartCommand: async (message: any, bot: any) => {
      const userId = message.from.id;
      console.log(`🚀 /start invoked by ${userId}`);

      const human = await getOrCreateHuman(message);
      if (!human?.id) {
        console.error(`❌ Failed to create human record for ${userId}`);
        return;
      }

      await bot.userContextManager.getOrCreateContext(userId, human.id);
      await bot.userContextManager.setVariable(userId, '_system.currentMessage', message);
      await bot.userContextManager.setVariable(userId, 'onboarding', {});

      await handlerWorker.flowEngine.startFlow(userId, 'onboarding');
      console.log(`✅ Onboarding flow started for ${userId}`);
    },

    handleMenuCommand: async (message: any) => {
      const userId = message.from.id;
      console.log(`📋 /menu requested by ${userId}`);
      await handlerWorker.flowEngine.startFlow(userId, 'menu');
    },

    matcherAssignTopicHandler: async (telegramId: number, contextManager: UserContextManager) => {
      console.log(`🧩 matcherAssignTopicHandler for ${telegramId}`);
      const context = await contextManager.getContext(telegramId);
      if (!context) {
        console.error('Context not found for matcherAssignTopicHandler');
        return;
      }

      const role = context.data?.onboarding?.role as Role | undefined;
      const itemType = context.data?.onboarding?.itemType as ItemType | undefined;
      const combination = buildCombinationKey(role, itemType);

      if (!combination) {
        console.warn('Combination not defined, asking user to restart onboarding');
        await handlerWorker.messageService.sendMessage(telegramId, 'Не удалось определить выбранную роль. Пожалуйста, начните онбординг заново командой /start.', context.humanId);
        await handlerWorker.flowEngine.completeFlow(telegramId);
        return;
      }

      const human = await handlerWorker.humanRepository.getHumanByTelegramId(telegramId);
      if (!human?.haid) {
        console.error('Human not found or missing haid for matcherAssignTopicHandler');
        return;
      }

      const fullName = context.data?.onboarding?.name || human.fullName || 'Участник';
      const email = context.data?.onboarding?.email;

      if (fullName) {
        await handlerWorker.humanRepository.updateHuman(telegramId, {
          fullName,
          email
        });
      }

      const group = await getGroupByCombination(combination);
      const chatId = parseInt(group.value!, 10);
      const existingThread = await handlerWorker.messageThreadRepository.getThreadByXaidAndStatus(
        human.haid,
        combination,
        'matcher'
      );

      let topicId: number | null = existingThread?.value ? parseInt(existingThread.value, 10) : null;

      if (!topicId) {
        const topicTitle = buildTopicTitle(fullName, combination);
        topicId = await handlerWorker.topicService.createTopic(topicTitle, 0x6FB9F0, chatId);
        if (!topicId) {
          throw new Error('Failed to create topic in Telegram');
        }

        await handlerWorker.messageThreadRepository.addMessageThread({
          parentMaid: group.maid,
          title: topicTitle,
          statusName: combination,
          type: 'matcher',
          xaid: human.haid,
          value: topicId.toString(),
          dataIn: JSON.stringify({
            chat_id: chatId,
            combination
          })
        });

        console.log(`🆕 Created topic ${topicId} in ${group.title} for human ${telegramId}`);
      } else {
        console.log(`♻️ Reusing topic ${topicId} for combination ${combination}`);
      }

      const humanData = parseHumanDataIn(human);
      humanData.telegram_id = telegramId;
      humanData.topic_id = topicId;
      humanData.topic_chat_id = chatId;
      humanData.last_combination = combination;
      humanData.profile = {
        ...(humanData.profile || {}),
        name: fullName,
        email
      };
      humanData.topics = humanData.topics || {};
      humanData.topics[combination] = {
        topic_id: topicId,
        chat_id: chatId,
        status_name: combination
      };

      await saveHumanDataIn(telegramId, humanData);
      await contextManager.setVariable(telegramId, 'onboarding.topicId', topicId);
      await contextManager.setVariable(telegramId, 'onboarding.chatId', chatId);

      const introMessage = [
        `👤 <b>${fullName}</b> подключился к роли "${ROLE_LABELS[role!]} ${ITEM_LABELS[itemType!]}"`,
        email ? `Email: ${email}` : null,
        `Telegram: @${humanData.username || '—'}`
      ].filter(Boolean).join('\n');

      await notifyTopic(chatId, topicId, introMessage);
    },

    matcherSaveOfferHandler: async (telegramId: number, contextManager: UserContextManager) => {
      console.log(`💼 matcherSaveOfferHandler for ${telegramId}`);
      if (!productRepository) {
        console.error('Product repository is unavailable');
        return;
      }

      const { topicId, chatId, context } = await getTopicRouting(telegramId, contextManager);
      if (!topicId || !chatId || !context) {
        console.warn('Topic routing not found for offer handler');
        return;
      }

      const onboardingData = context.data?.onboarding || {};
      const title = onboardingData.offer?.title;
      const description = onboardingData.offer?.description;
      const price = parseNumber(onboardingData.offer?.price);
      const role = onboardingData.role as Role | undefined;
      const itemType = onboardingData.itemType as ItemType | undefined;
      const combination = buildCombinationKey(role, itemType);

      const human = await handlerWorker.humanRepository.getHumanByTelegramId(telegramId);
      if (!human?.haid) {
        console.error('Human not found for matcherSaveOfferHandler');
        return;
      }

      await productRepository.addProduct({
        title,
        type: itemType,
        category: role,
        xaid: human.haid,
        dataIn: JSON.stringify({
          description,
          price,
          telegram_id: telegramId,
          combination
        }),
        statusName: 'active'
      });

      const offerMessage = [
        `🧾 <b>${ROLE_LABELS[role || 'offer']} ${ITEM_LABELS[itemType || 'product']}</b>`,
        title ? `Название: ${title}` : null,
        description ? `Описание: ${description}` : null,
        price !== null ? `Стоимость: ${price}` : null
      ].filter(Boolean).join('\n');

      await notifyTopic(chatId, topicId, offerMessage);
    },

    matcherSaveSearchHandler: async (telegramId: number, contextManager: UserContextManager) => {
      console.log(`🔍 matcherSaveSearchHandler for ${telegramId}`);
      const { topicId, chatId, context } = await getTopicRouting(telegramId, contextManager);
      if (!topicId || !chatId || !context) {
        console.warn('Topic routing not found for search handler');
        return;
      }

      const onboardingData = context.data?.onboarding || {};
      const description = onboardingData.search?.description;
      const role = onboardingData.role as Role | undefined;
      const itemType = onboardingData.itemType as ItemType | undefined;

      const searchMessage = [
        `📌 <b>${ROLE_LABELS[role || 'search']} ${ITEM_LABELS[itemType || 'service']}</b>`,
        description ? `Описание: ${description}` : 'Описание не указано'
      ].join('\n');

      await notifyTopic(chatId, topicId, searchMessage);
    }
  };
};