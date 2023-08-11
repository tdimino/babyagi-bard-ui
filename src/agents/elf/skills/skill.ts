import { AgentTask, LLMParams, AgentMessage } from '@/types';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanChatMessage } from 'langchain/schema';
import { v4 as uuidv4 } from 'uuid';

export type SkillType = 'normal' | 'dev';
export type SkillExecutionLocation = 'client' | 'server';

export class Skill {
  name: string = 'base_kill';
  descriptionForHuman: string = 'This is the base skill.';
  descriptionForModel: string = 'This is the base skill.';
  icon: string = '🛠️';
  type: SkillType = 'normal'; // If available only in the local development environment, be sure to use dev type.
  apiKeysRequired: Array<string | Array<string>> = [];
  valid: boolean;
  apiKeys: { [key: string]: string };
  executionLocation: SkillExecutionLocation = 'client'; // 'client' or 'server'
  // for UI
  handleMessage: (message: AgentMessage) => void;
  verbose: boolean;
  language: string = 'en';

  // This index signature allows dynamic assignment of properties
  [key: string]: any;

  constructor(
    apiKeys: { [key: string]: string },
    handleMessage: (message: AgentMessage) => Promise<void>,
    verbose: boolean = false,
    language: string = 'en',
  ) {
    this.apiKeys = apiKeys;
    this.handleMessage = handleMessage;
    this.verbose = verbose;
    this.language = language;

    const missingKeys = this.checkRequiredKeys(apiKeys);
    if (missingKeys.length > 0) {
      console.log(`Missing API keys for ${this.name}: ${missingKeys}`);
      this.valid = false;
    } else {
      this.valid = true;
    }
    for (const key of this.apiKeysRequired) {
      if (Array.isArray(key)) {
        for (const subkey of key) {
          if (subkey in apiKeys) {
            this[`${subkey}_apiKey`] = apiKeys[subkey];
          }
        }
      } else if (key in apiKeys) {
        this[`${key}_apiKey`] = apiKeys[key];
      }
    }

    this.valid =
      this.type === 'dev' ? process.env.NODE_ENV === 'development' : true;
  }

  checkRequiredKeys(apiKeys: {
    [key: string]: string;
  }): Array<string | Array<string>> {
    const missingKeys: Array<string | Array<string>> = [];
    for (const key of this.apiKeysRequired) {
      if (Array.isArray(key)) {
        if (!key.some((k) => k in apiKeys)) {
          missingKeys.push(key);
        }
      } else if (!(key in apiKeys)) {
        missingKeys.push(key);
      }
    }
    return missingKeys;
  }

  async execute(
    task: AgentTask,
    dependentTaskOutputs: string,
    objective: string,
  ): Promise<string> {
    // This method should be overridden by subclasses
    throw new Error("Method 'execute' must be implemented");
  }

  async generateText(
    prompt: string,
    task: AgentTask,
    params: LLMParams = {},
    ignoreCallback: boolean = false,
  ): Promise<string> {
    const messageCallback = ignoreCallback ? () => {} : this.handleMessage;
    const id = uuidv4();
    const defaultParams = {
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1500,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      streaming: true,
    };
    const llmParams = { ...defaultParams, ...params };
    const llm = new ChatOpenAI(
      {
        openAIApiKey: this.apiKeys.openai,
        ...llmParams,
        callbacks: [
          {
            handleLLMNewToken(token: string) {
              messageCallback?.({
                id,
                content: token,
                title: `${task.task}`,
                style: 'task',
                type: task.skill,
                icon: '🤖',
                taskId: task.id.toString(),
                status: 'running',
                options: {
                  dependentTaskIds: task.dependentTaskIds?.join(',') ?? '',
                },
              });
            },
          },
        ],
      },
      // { baseOptions: { signal: this.abortController.signal } },
    );

    try {
      const response = await llm.call([new HumanChatMessage(prompt)]);
      messageCallback?.({
        id,
        taskId: task.id.toString(),
        content: response.text,
        title: task.task,
        icon: '✅',
        style: 'task',
        type: task.skill,
        status: 'complete',
        options: {
          dependentTaskIds: task.dependentTaskIds?.join(',') ?? '',
        },
      });
      return response.text;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return `Task aborted.`;
      }
      console.log('error: ', error);
      return 'Failed to generate text.';
    }
  }
}
