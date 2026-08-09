General:

- I want the web site to run without claude, that is, everything is hard coded to do the work on its own.  The claude skills mds, claude.md, etc. should push the design and implementation.  So if I'm running a skill from here it's claude, if I'm running it from the web site it's from implemented code on the site.  It still saves data in the appropriate dealership, reference, or vehicles md files (this is the backend database effectively which both the site and the Claude CLI can use).  The site should not show itself as having "skills" in the Claude sense.  For example, the skills page shouldn't be a thing.  Those should come up modals via buttons on the appropriate vehicle, dealership, etc. page.  
- Update the .gitignore so my dealership and vehicle R&D is never pushed to github
- WHenever the tool is researching something a modal should open with cool sports car, speeding, etc. related graphics.  It should should show something is happening, a progress indictor, and text for what's occuring at any given moment.  If it needs to ask questions about what to do next during these runs, it should happen as part of the modal.  The user can't exit the modal except via a cancel button on it.
- Generate a UIX standard file that claude uses when working on the website.  Look at the rest of this file for standards I want in it and applied going forward for how tables should display and behave.
- Come up with better icon and graphic usage.  For example, on a car report I'd want to see a red ! or something similar next to red flags, have the text in red, etc., things that would be positive would be in green, things concerning to be looked into more would be yellow.  Lots that can be designed in this regard.
- UIX - Links to external sites should always open in a new tab.
- if referenced sites have pulic api's, code against those.
- I want to be able to tell the tool to go out, check ads to see if specific cars are still available, if so mark any price drops, and create reports.  Show me a detailed history of each to give me a sense what dealerships are willing to wiggle on.
- Add a dream car page where I can add in a table the list of make/model[/years] of all the one's I'm primarily keeping my eyes on

Dealership page:

- I want the option to add or as well as analyze a dealership
- I should see dealerships in a table with columns that include the name, link icon, location, and other important high level details
- I should be able to sort and filter on any column in the table
- I should be able to search the dealerships from the page
- I should be able to delete a dealership
- I should be able to rate dealerships with a star rating, as a favourite, as an avoid at all costs
- I should be able to add my own notes to dealerships as well as include correspondence with them, how and when that happened, who it was with, etc., what car, if applicable, the conversation(s) were about etc.
- For dealership analysis include how much they're willing to haggle, lower prices, etc.


Vehicles page:
- I want the ability to add as well as research a vehicle, whether it be by make/model/year, or a specific one for sale from the page.
- I should see vehicles in a treeview and each row contains pertinent high level information.  This is actually a tree that starts at make, then model, then year.  If there are specific examples I've researched they should be under year.  Each level of the tree will have an indicator how many children it has.
- I should be able to search the cars from the page
- I should be able to delete a car, make, model, year, etc.  If it has descendants all of those get deleted.
- I should be able to rate a car, make, model, year, specific one with a star rating, as a favourite, as an avoid at all costs
- I should be able to add my own notes on cars' specific pages 
- When I select a make/model/year, I want to see the specific vehicles researched in a table, following the standards we're putting together for tables
- Page showing the details on a specific vehicle:  1) The dealership should be a link taking me to the dealership page of the specific dealership.
- R&D for vehicles should include the specifications on it (if that's not already the case)
- Don't need to show the link on the specific vehicle page, that should be a pretty hyperlink icon maybe to the left of the title
- If there's a carfax report the link to it should also be on the page, accessible via an icon
- for cars w/ make/model or make/model/year I want to be able to do an updated search that will find new ones I haven't seen yet, ask me If I want to add them to my r&d

Market Analysis:
- There should be a capaility to do full market analysis on a vehicle by make/model/year or a specific one
- I should be able to run in against an area, state, or country wide.
- I should be able to specify paremters about mileage and other factors to match
- I should be able to save results or subset of results for future reference.

Reference page:
- There should be a reference page, accessible from the home page, that allows me to add/modify/remove car review sites, car sites, and general dealerhsip review sites.


