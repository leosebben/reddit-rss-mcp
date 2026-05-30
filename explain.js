/**
 * Dicionário estático de termos do Reddit (paridade com reddit-buddy).
 * Não faz rede — explicações fixas.
 */
export const EXPLANATIONS = {
  karma: {
    definition: 'Reddit points earned from upvotes on posts and comments',
    origin: "Concept from Hinduism/Buddhism adapted for Reddit's scoring system",
    usage: 'Users accumulate karma to show contribution quality',
    examples: ['High karma users are often trusted more', 'Some subreddits require minimum karma to post'],
  },
  'cake day': {
    definition: 'Anniversary of when a user joined Reddit',
    origin: 'Reddit displays a cake icon next to usernames on this day',
    usage: 'Users often get extra upvotes on their cake day',
    examples: ['Happy cake day!', "It's my cake day, AMA"],
  },
  ama: {
    definition: 'Ask Me Anything - Q&A session with interesting people',
    origin: 'Started in r/IAmA subreddit',
    usage: 'Celebrities, experts, or people with unique experiences answer questions',
    examples: ['I am Elon Musk, AMA', 'I survived a plane crash, AMA'],
  },
  eli5: {
    definition: "Explain Like I'm 5 - request for simple explanation",
    origin: 'From r/explainlikeimfive subreddit',
    usage: 'Used when asking for complex topics to be explained simply',
    examples: ['ELI5: How does bitcoin work?', 'Can someone ELI5 quantum computing?'],
  },
  til: {
    definition: 'Today I Learned - sharing interesting facts',
    origin: 'From r/todayilearned subreddit',
    usage: 'Prefix for sharing newly discovered information',
    examples: ['TIL bananas are berries', 'TIL about the Baader-Meinhof phenomenon'],
  },
  op: {
    definition: 'Original Poster - person who created the post',
    origin: 'Common internet forum terminology',
    usage: 'Refers to the person who started the discussion',
    examples: ['OP delivers!', 'Waiting for OP to respond'],
  },
  repost: {
    definition: 'Content that has been posted before',
    origin: 'Common issue on content aggregation sites',
    usage: "Often called out by users who've seen the content before",
    examples: ['This is a repost from last week', 'General Reposti!'],
  },
  brigading: {
    definition: 'Coordinated effort to manipulate votes or harass',
    origin: 'Named after military brigade tactics',
    usage: 'Against Reddit rules, can result in bans',
    examples: ["Don't brigade other subs", 'This looks like brigading'],
  },
  '/s': {
    definition: 'Sarcasm indicator',
    origin: 'HTML-style closing tag for sarcasm',
    usage: 'Added to end of sarcastic comments to avoid misunderstanding',
    examples: ["Yeah, that's totally going to work /s", 'Great idea /s'],
  },
  'banana for scale': {
    definition: 'Using a banana to show size in photos',
    origin: 'Started as a Reddit meme in 2013',
    usage: 'Humorous way to provide size reference',
    examples: ['Found this rock, banana for scale', 'No banana for scale?'],
  },
};

export function explain(term) {
  const e = EXPLANATIONS[String(term).toLowerCase()];
  if (!e) {
    return {
      definition: 'Term not found in database. This might be a subreddit-specific term or newer slang.',
      origin: 'Unknown',
      usage: "Try searching Reddit for this term to see how it's used",
      examples: [],
      relatedTerms: [],
    };
  }
  return { ...e, relatedTerms: [] };
}
