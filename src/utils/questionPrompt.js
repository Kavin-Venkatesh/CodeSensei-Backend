const QuestionPrompt = (topic , difficulty) => {
    return `
    Generate a coding question in JSON format in the given topic and difficulty level.
    Topic: ${topic}
    Difficulty Level: ${difficulty}

    the format should strictly be like this:
     {
        "title": "string",
        "description": "string",
        "samples": [
          {
            "input": "string",
            "output": "string",
            "explanation": "string"
          }
        ]
      }
    `;
};

export default QuestionPrompt;
