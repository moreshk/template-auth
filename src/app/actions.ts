'use server'

import { OpenAI } from 'openai'
import { getServerSession } from "next-auth/next"

export async function analyzeJob(website: string, description: string): Promise<string> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const prompt = `
    Analyze this job opportunity and company. First, determine if this is posted by a recruiter/staffing agency or the direct employer.
    Website/Company info: ${website || 'Not provided'}
    Job Description: ${description}
    
    Please provide an analysis that covers the following points in HTML format:
    <div class="analysis">
      <section class="posting-type">
        <h3>Job Posted By</h3>
        <p>[Indicate if this is posted by a recruiter/staffing agency or direct employer. If it's a recruiter, mention this is likely not the end client.]</p>
      </section>
      
      <section class="company-overview">
        <h3>Company Overview</h3>
        <p>[Company overview content - if recruiter, focus on the recruiting company's background]</p>
      </section>
      
      <section class="key-expectations">
        <h3>Key Expectations</h3>
        <ul>
          <li>[Expectation 1]</li>
          <li>[Expectation 2]</li>
          ...
        </ul>
      </section>
      
      <section class="looking-for">
        <h3>What They're Looking For</h3>
        <ul>
          <li>[Requirement 1]</li>
          <li>[Requirement 2]</li>
          ...
        </ul>
      </section>
      
      <section class="key-challenges">
        <h3>Key Challenges</h3>
        <ul>
          <li>[Challenge 1]</li>
          <li>[Challenge 2]</li>
          ...
        </ul>
      </section>
    </div>
  `

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a professional job analysis assistant. Provide a detailed analysis and format the output in HTML as specified.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(`API error: ${JSON.stringify(data)}`)
    }
    return data.choices[0].message.content
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

export async function analyzeFitForJob(jobAnalysis: string, resume: string): Promise<string> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const prompt = `
    Based on the following job analysis and resume, evaluate if the candidate is a good fit for the role.
    Provide your response in this HTML format without any surrounding backticks:
    <div class="fit-analysis">
      <section>
        <h3>Overall Assessment</h3>
        <p>[Your assessment here]</p>
      </section>

      <section>
        <h3>Matching Skills & Experience</h3>
        <ul>
          [List matching skills/experience]
        </ul>
      </section>

      <section>
        <h3>Resume Focus Recommendations</h3>
        <p>Based on your current resume:</p>
        <h4>Experiences to Emphasize More:</h4>
        <ul>
          [List specific experiences/projects from the resume that align with the role]
        </ul>
        <h4>Experiences to De-emphasize:</h4>
        <ul>
          [List specific experiences/projects from the resume that are less relevant]
        </ul>
        <h4>How to Reframe:</h4>
        <ul>
          [Specific suggestions for reframing existing experiences to better match requirements]
        </ul>
      </section>

      <section>
        <h3>Potential Areas to Address</h3>
        <p>Do you have any of the following experiences or credentials that are not mentioned in your resume?</p>
        <ul>
          [List specific gaps as questions]
        </ul>
      </section>
      
    </div>

    Job Analysis:
    ${jobAnalysis}

    Resume:
    ${resume}

    Important: 
    - Reference specific projects, roles, or experiences from the resume in your recommendations
    - Be precise about which parts of their background to highlight or minimize
    - Provide actionable suggestions for reframing existing experience
  `

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.7,
    })

    return completion.choices[0].message.content || 'No analysis generated'
  } catch (error) {
    console.error('Error in analyzeFitForJob:', error)
    throw new Error('Failed to analyze fit')
  }
}

export async function generateResume(jobAnalysis: string, originalResume: string, additionalInfo: string, fitAnalysis: string): Promise<string> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const prompt = `
    Based on the following job analysis, original resume, additional information, and fit analysis, generate an optimized resume for this specific job opportunity.
    
    Job Analysis:
    ${jobAnalysis}

    Original Resume:
    ${originalResume}

    Additional Information:
    ${additionalInfo}

    Fit Analysis:
    ${fitAnalysis}

    Format Requirements:
    1. Use HTML with distinct sections wrapped in <section> tags with unique data-section-id attributes
    2. Use <ul> and <li> tags for bullet points in experience, skills, and achievements
    3. Structure each major section (e.g., experience, education, skills) in separate sections
    4. Use appropriate heading tags (h1, h2, h3) for hierarchy
    5. Example format:
       <div class="resume">
         <section data-section-id="header">
           <h1>Full Name</h1>
           <p>Contact Information</p>
         </section>
         <section data-section-id="summary">
           <h2>Professional Summary</h2>
           <p>[Summary content]</p>
         </section>
         <section data-section-id="experience">
           <h2>Professional Experience</h2>
           <div class="job">
             <h3>Job Title</h3>
             <p>Company Name | Date Range</p>
             <ul>
               <li>Achievement 1</li>
               <li>Achievement 2</li>
             </ul>
           </div>
         </section>
         <section data-section-id="skills">
           <h2>Skills</h2>
           <ul>
             <li>Skill 1</li>
             <li>Skill 2</li>
           </ul>
         </section>
       </div>

    Instructions:
    1. Rework the resume to highlight experiences and skills that are most relevant to the job requirements.
    2. Incorporate the additional information provided by the candidate.
    3. Follow the focus recommendations from the fit analysis.
    4. Format the resume in a clean, professional style using HTML.
    5. Ensure the resume is well-structured and easy to read.
    6. Use appropriate spacing and formatting to improve readability.

    Please provide the optimized resume in HTML format, ready for display and PDF conversion.
  `

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
    })

    return completion.choices[0].message.content || 'Failed to generate resume'
  } catch (error) {
    console.error('Error in generateResume:', error)
    throw new Error('Failed to generate resume')
  }
}

export async function generateCoverLetter(jobAnalysis: string, resume: string, additionalInfo: string, fitAnalysis: string): Promise<string> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const prompt = `
    Generate a personalized cover letter based on the job analysis, resume, and fit analysis provided.
    The cover letter should be concise, professional, and highlight the most relevant experiences that make the candidate an excellent fit for this role.

    Job Analysis:
    ${jobAnalysis}

    Resume:
    ${resume}

    Additional Information:
    ${additionalInfo}

    Fit Analysis:
    ${fitAnalysis}

    Requirements:
    1. Format the cover letter in HTML
    2. Keep it concise (2-3 paragraphs)
    3. Highlight specific experiences that match the job requirements
    4. Include a strong opening and closing
    5. Maintain a professional yet engaging tone
    6. End with a call to action for an interview

    Format the response in this HTML structure:
    <div class="cover-letter">
      <section class="header">
        [Date]
        [Hiring Manager/Recruiter Name if available]
        [Company Name]
      </section>
      
      <section class="content">
        <p>[Opening paragraph - Hook and position interest]</p>
        <p>[Body paragraph(s) - Specific relevant experiences and achievements]</p>
        <p>[Closing paragraph - Call to action]</p>
      </section>
      
      <section class="signature">
        Sincerely,
        [Candidate Name]
      </section>
    </div>
  `

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'o3-mini',
      // temperature: 0.7,
    })

    return completion.choices[0].message.content || 'Failed to generate cover letter'
  } catch (error) {
    console.error('Error in generateCoverLetter:', error)
    throw new Error('Failed to generate cover letter')
  }
} 